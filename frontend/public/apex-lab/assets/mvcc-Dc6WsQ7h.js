var e=`// MVCC — Multi-Version Concurrency Control, how PostgreSQL, Oracle, and MySQL/InnoDB let\r
// readers and writers run without blocking each other. Instead of overwriting a row, a\r
// write creates a NEW VERSION tagged with the transaction that made it (xmin) and, when\r
// superseded, the transaction that retired it (xmax). Each transaction runs against a\r
// SNAPSHOT: the set of transactions already committed when it began. A version is visible\r
// to a snapshot iff it was created by a transaction the snapshot can see AND not yet\r
// deleted by one it can see. So a long read sees a stable, consistent picture while writers\r
// keep producing new versions alongside — that's snapshot isolation. Pure, tested.\r
\r
export interface Version { value: string; xmin: number; xmax: number | null } // creator / retirer txids\r
export type Store = Record<string, Version[]>;\r
\r
export interface Snapshot { txid: number; committed: Set<number> } // txns committed before this snapshot began\r
\r
/** A version is visible to a snapshot if its creator is visible and its retirer is not. */\r
function visible(v: Version, s: Snapshot): boolean {\r
  const creatorVisible = v.xmin === s.txid || s.committed.has(v.xmin);\r
  const retirerVisible = v.xmax !== null && (v.xmax === s.txid || s.committed.has(v.xmax));\r
  return creatorVisible && !retirerVisible;\r
}\r
\r
export interface ReadResult { value: string | null; versionsTotal: number }\r
\r
/** Read the one version of \`key\` visible to this snapshot. */\r
export function read(store: Store, key: string, snap: Snapshot): ReadResult {\r
  const versions = store[key] ?? [];\r
  const v = versions.find((ver) => visible(ver, snap));\r
  return { value: v ? v.value : null, versionsTotal: versions.length };\r
}\r
\r
export interface WriteResult { ok: boolean; conflict: boolean; reason: string }\r
\r
/** Write a new version: retire the version this txn sees and append a new one. Enforces snapshot\r
 *  isolation's FIRST-UPDATER-WINS rule — if a concurrent transaction (one this snapshot can't see)\r
 *  already wrote this row, the write is rejected as a write-write conflict instead of silently losing\r
 *  the update and leaking a second live version. */\r
export function write(store: Store, key: string, value: string, snap: Snapshot): WriteResult {\r
  const versions = store[key] ?? (store[key] = []);\r
  const cur = versions.find((ver) => visible(ver, snap));\r
  // conflict if a live version exists that our snapshot can't see (a concurrent writer beat us),\r
  // or the version we'd update was already retired by a transaction outside our snapshot.\r
  const concurrentWrite = versions.some((v) => v.xmax === null && v.xmin !== snap.txid && !snap.committed.has(v.xmin));\r
  const retiredByConcurrent = cur != null && cur.xmax !== null && cur.xmax !== snap.txid && !snap.committed.has(cur.xmax);\r
  if (concurrentWrite || retiredByConcurrent) {\r
    return { ok: false, conflict: true, reason: \`write-write conflict on "\${key}": a concurrent transaction wrote it first → abort\` };\r
  }\r
  if (cur) cur.xmax = snap.txid;\r
  versions.unshift({ value, xmin: snap.txid, xmax: null }); // newest first\r
  return { ok: true, conflict: false, reason: 'new version created' };\r
}\r
\r
export const emptyStore = (): Store => ({});\r
\r
/** All live versions of a key with a visibility flag for a given snapshot (for display). */\r
export function inspect(store: Store, key: string, snap: Snapshot): { version: Version; visible: boolean }[] {\r
  return (store[key] ?? []).map((version) => ({ version, visible: visible(version, snap) }));\r
}\r
`;export{e as default};