var e=`// LSM-tree (Log-Structured Merge tree) — the write-optimized storage engine behind\r
// RocksDB, LevelDB, Cassandra, and ScyllaDB. Writes never seek: a put just goes into an\r
// in-memory sorted MEMTABLE. When the memtable fills, it's flushed to disk as an immutable\r
// sorted file (an SSTABLE) and a fresh memtable starts. Reads check the memtable first,\r
// then the SSTables newest-to-oldest, stopping at the first hit. Deletes write a TOMBSTONE\r
// that shadows older values. Over time COMPACTION merges SSTables, keeping only the newest\r
// value per key and dropping tombstones — reclaiming space at the cost of write\r
// amplification. The mirror image of a B+tree: cheap writes, pricier reads. Pure, tested.\r
\r
export type Value = string | null; // null = tombstone (a delete marker)\r
export interface SSTable { id: number; entries: [string, Value][] } // sorted by key\r
\r
export interface Lsm {\r
  memtable: Map<string, Value>;\r
  sstables: SSTable[]; // newest LAST\r
  threshold: number;\r
  nextId: number;\r
  flushes: number;\r
}\r
\r
export const create = (threshold = 4): Lsm => ({ memtable: new Map(), sstables: [], threshold, nextId: 0, flushes: 0 });\r
\r
/** Flush the memtable to a new immutable, sorted SSTable. */\r
function flush(lsm: Lsm): void {\r
  if (lsm.memtable.size === 0) return;\r
  const entries = [...lsm.memtable.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));\r
  lsm.sstables.push({ id: lsm.nextId++, entries });\r
  lsm.memtable = new Map();\r
  lsm.flushes++;\r
}\r
\r
export function put(lsm: Lsm, key: string, value: string): void {\r
  lsm.memtable.set(key, value);\r
  if (lsm.memtable.size >= lsm.threshold) flush(lsm);\r
}\r
\r
/** Delete = write a tombstone (it shadows any older value until compaction drops it). */\r
export function del(lsm: Lsm, key: string): void {\r
  lsm.memtable.set(key, null);\r
  if (lsm.memtable.size >= lsm.threshold) flush(lsm);\r
}\r
\r
export interface ReadResult { value: string | null; foundIn: string }\r
\r
/** Read newest-first: memtable, then SSTables from newest to oldest. */\r
export function get(lsm: Lsm, key: string): ReadResult {\r
  if (lsm.memtable.has(key)) {\r
    const v = lsm.memtable.get(key)!;\r
    return { value: v, foundIn: v === null ? 'memtable (tombstone)' : 'memtable' };\r
  }\r
  for (let i = lsm.sstables.length - 1; i >= 0; i--) {\r
    const hit = lsm.sstables[i].entries.find(([k]) => k === key);\r
    if (hit) return { value: hit[1], foundIn: hit[1] === null ? \`SSTable \${lsm.sstables[i].id} (tombstone)\` : \`SSTable \${lsm.sstables[i].id}\` };\r
  }\r
  return { value: null, foundIn: 'not found' };\r
}\r
\r
/** How many SSTables a read for \`key\` must touch before it hits (read amplification). */\r
export function readCost(lsm: Lsm, key: string): number {\r
  if (lsm.memtable.has(key)) return 0;\r
  let n = 0;\r
  for (let i = lsm.sstables.length - 1; i >= 0; i--) { n++; if (lsm.sstables[i].entries.some(([k]) => k === key)) return n; }\r
  return n;\r
}\r
\r
/** Compact all SSTables into one: newest value per key wins, tombstones are dropped. */\r
export function compact(lsm: Lsm): void {\r
  const merged = new Map<string, Value>();\r
  for (const t of lsm.sstables) for (const [k, v] of t.entries) merged.set(k, v); // later (newer) overwrites\r
  const entries = [...merged.entries()].filter(([, v]) => v !== null).sort((a, b) => (a[0] < b[0] ? -1 : 1));\r
  lsm.sstables = entries.length ? [{ id: lsm.nextId++, entries }] : [];\r
}\r
`;export{e as default};