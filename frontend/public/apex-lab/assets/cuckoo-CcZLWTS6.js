var e=`// Cuckoo hashing (Pagh & Rodler, 2001) — a hash table with O(1) WORST-CASE lookup, because\r
// every key lives in exactly one of two possible slots (given by two hash functions). The\r
// name comes from the cuckoo bird: on insert, if your slot is taken, you kick the current\r
// occupant out and re-home it in ITS other slot — which may displace another key, and so on,\r
// a chain of evictions. If the chain loops too long the table is full and must be resized\r
// (or re-hashed). It's the idea behind cuckoo FILTERS, which (unlike Bloom filters) support\r
// deletion. Deterministic hashes are injected so the eviction chains are reproducible.\r
\r
export interface Cuckoo { m: number; table: (string | null)[]; seedA: number; seedB: number }\r
\r
function h(key: string, seed: number, m: number): number {\r
  let x = seed >>> 0;\r
  for (let i = 0; i < key.length; i++) { x ^= key.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }\r
  x ^= x >>> 15;\r
  return (x >>> 0) % m;\r
}\r
\r
export const create = (m = 11, seedA = 0x9e3779b1, seedB = 0x85ebca77): Cuckoo =>\r
  ({ m, table: new Array(m).fill(null), seedA, seedB });\r
\r
export const slots = (c: Cuckoo, key: string): [number, number] => [h(key, c.seedA, c.m), h(key, c.seedB, c.m)];\r
\r
export interface InsertResult { ok: boolean; evictions: { key: string; from: number; to: number }[] }\r
\r
/** Insert a key, kicking out occupants along the way. On failure (a chain too long, or a\r
 *  key whose two hashes collide and has nowhere to go) the table is ROLLED BACK so no\r
 *  previously-stored key is ever lost and the failing key is not left behind. */\r
export function insert(c: Cuckoo, key: string, maxKicks = 16): InsertResult {\r
  const [s1, s2] = slots(c, key);\r
  if (c.table[s1] === key || c.table[s2] === key) return { ok: true, evictions: [] }; // already present\r
  if (c.table[s1] === null) { c.table[s1] = key; return { ok: true, evictions: [] }; }\r
  if (c.table[s2] === null) { c.table[s2] = key; return { ok: true, evictions: [] }; }\r
\r
  const snapshot = [...c.table];                 // for rollback if the chain fails\r
  const evictions: InsertResult['evictions'] = [];\r
  let cur = key, pos = s1;\r
  for (let n = 0; n < maxKicks; n++) {\r
    if (c.table[pos] === null) { c.table[pos] = cur; return { ok: true, evictions }; }\r
    const displaced = c.table[pos]!;             // evict the occupant\r
    c.table[pos] = cur;\r
    const [a, b] = slots(c, displaced);\r
    const nextPos = a === pos ? b : a;           // its OTHER slot\r
    if (nextPos === pos) {                        // its two hashes collide → no alternate\r
      c.table = snapshot;                         // roll back: lose nothing\r
      return { ok: false, evictions: [] };\r
    }\r
    evictions.push({ key: displaced, from: pos, to: nextPos });\r
    cur = displaced;\r
    pos = nextPos;\r
  }\r
  c.table = snapshot;                             // chain too long → roll back, table unchanged\r
  return { ok: false, evictions: [] };\r
}\r
\r
/** Lookup: at most two probes, ever. */\r
export function lookup(c: Cuckoo, key: string): { found: boolean; at: number | null; probes: number[] } {\r
  const [s1, s2] = slots(c, key);\r
  if (c.table[s1] === key) return { found: true, at: s1, probes: [s1] };\r
  if (c.table[s2] === key) return { found: true, at: s2, probes: [s1, s2] };\r
  return { found: false, at: null, probes: s1 === s2 ? [s1] : [s1, s2] };\r
}\r
\r
export function remove(c: Cuckoo, key: string): boolean {\r
  const r = lookup(c, key);\r
  if (r.found && r.at !== null) { c.table[r.at] = null; return true; } // O(1) delete — Bloom can't\r
  return false;\r
}\r
`;export{e as default};