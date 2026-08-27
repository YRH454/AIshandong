var e=`// HAMT — Hash Array Mapped Trie, the data structure behind persistent/immutable maps (Clojure, Scala,\r
// immutable.js, Erlang maps). Two ideas combine. First, a TRIE keyed by a hash: chop the key's 32-bit hash\r
// into 5-bit chunks (0..31) and use one chunk per level to descend — so lookups are O(log32 n), effectively\r
// constant for real sizes. Second, each node is SPARSE: instead of a 32-slot array (mostly empty), it stores a\r
// 32-bit bitmap of which slots are occupied plus a dense array of only those children; slot i's position in\r
// the array is popcount(bitmap & (bit_i − 1)). That keeps nodes tiny. The payoff is PERSISTENCE: "updating"\r
// the map never mutates it — set() copies only the nodes along the path from the root to the changed leaf and\r
// reuses (shares) every other subtree unchanged. You get a brand-new root that coexists with the old one, both\r
// valid, sharing almost all their memory. That's how immutable collections give you cheap copies and safe\r
// concurrency. Two keys whose 32-bit hashes are fully equal land in a COLLISION bucket at the deepest level\r
// (a real HAMT does the same). This models a real HAMT with bitmap nodes, popcount indexing, path-copying\r
// set(), and collision buckets. Reference: Bagwell, "Ideal Hash Trees" (2001).\r
\r
const BITS = 5, MASK = 31;\r
\r
export interface Entry { key: string; value: number }\r
export interface Collision { bucket: Entry[] }                                   // 2+ entries with the same full hash\r
export interface Node { bitmap: number; children: (Node | Entry | Collision)[] } // children aligned to set bits, ascending\r
type Child = Node | Entry | Collision;\r
const isEntry = (x: Child): x is Entry => 'key' in x;\r
const isCollision = (x: Child): x is Collision => 'bucket' in x;\r
const isNode = (x: Child): x is Node => 'bitmap' in x;\r
export const emptyNode = (): Node => ({ bitmap: 0, children: [] });\r
\r
export function popcount(x: number): number { x = x >>> 0; let n = 0; while (x) { n += x & 1; x >>>= 1; } return n; }\r
\r
/** FNV-1a 32-bit hash of a string — deterministic. */\r
export function hash(key: string): number {\r
  let h = 0x811c9dc5;\r
  for (let i = 0; i < key.length; i++) { h = (h ^ key.charCodeAt(i)) >>> 0; h = Math.imul(h, 0x01000193) >>> 0; }\r
  return h >>> 0;\r
}\r
\r
export function get(node: Node, key: string): number | undefined {\r
  const h = hash(key);\r
  let n: Node = node, shift = 0;\r
  for (;;) {\r
    const bit = 1 << ((h >>> shift) & MASK);\r
    if (!(n.bitmap & bit)) return undefined;\r
    const child = n.children[popcount(n.bitmap & (bit - 1))];\r
    if (isEntry(child)) return child.key === key ? child.value : undefined;\r
    if (isCollision(child)) return child.bucket.find((e) => e.key === key)?.value; // deepest level: scan the bucket\r
    n = child; shift += BITS;\r
    if (shift > 30) return undefined; // safety: never compute h>>>35 (JS shifts are mod 32); collisions bucket by shift 30\r
  }\r
}\r
\r
// Push two entries with colliding hash-chunks down into fresh sub-nodes until their chunks differ; if the\r
// hashes are fully equal, they bottom out into a collision bucket.\r
function merge(e1: Entry, e2: Entry, h1: number, h2: number, shift: number): Node | Collision {\r
  if (shift > 30) return { bucket: [e1, e2] }; // hashes fully equal (no chunks left) → collision bucket\r
  const i1 = (h1 >>> shift) & MASK, i2 = (h2 >>> shift) & MASK;\r
  if (i1 === i2) return { bitmap: 1 << i1, children: [merge(e1, e2, h1, h2, shift + BITS)] };\r
  return { bitmap: (1 << i1) | (1 << i2), children: i1 < i2 ? [e1, e2] : [e2, e1] };\r
}\r
\r
/** Immutable insert/update: returns a NEW root that shares every subtree not on the path to \`key\`. */\r
export function set(node: Node, key: string, value: number): Node {\r
  const h = hash(key);\r
  const go = (n: Node, shift: number): Node => {\r
    const bit = 1 << ((h >>> shift) & MASK);\r
    const pos = popcount(n.bitmap & (bit - 1));\r
    if (!(n.bitmap & bit)) { // empty slot → drop the entry in\r
      const children = n.children.slice(); children.splice(pos, 0, { key, value });\r
      return { bitmap: n.bitmap | bit, children };\r
    }\r
    const child = n.children[pos];\r
    let next: Child;\r
    if (isEntry(child)) next = child.key === key ? { key, value } : merge(child, { key, value }, hash(child.key), h, shift + BITS);\r
    else if (isCollision(child)) { // same full hash → replace-or-append within the bucket (copy it)\r
      const found = child.bucket.some((e) => e.key === key);\r
      next = { bucket: found ? child.bucket.map((e) => (e.key === key ? { key, value } : e)) : child.bucket.concat({ key, value }) };\r
    } else next = go(child, shift + BITS);\r
    const children = n.children.slice(); children[pos] = next; // copy THIS node only\r
    return { bitmap: n.bitmap, children };\r
  };\r
  return go(node, 0);\r
}\r
\r
/** Collect all key/value pairs (order is hash-defined, not insertion order). */\r
export function entries(node: Node): Entry[] {\r
  const out: Entry[] = [];\r
  const walk = (n: Node) => { for (const c of n.children) isEntry(c) ? out.push(c) : isCollision(c) ? out.push(...c.bucket) : walk(c); };\r
  walk(node);\r
  return out;\r
}\r
\r
/** Count nodes shared (identical object) between two roots — the structural-sharing metric. */\r
export function sharedNodes(oldRoot: Node, newRoot: Node): { shared: number; copied: number; total: number } {\r
  const oldSet = new Set<Node>();\r
  const collect = (n: Node) => { oldSet.add(n); for (const c of n.children) if (isNode(c)) collect(c); };\r
  collect(oldRoot);\r
  let shared = 0, copied = 0;\r
  const walk = (n: Node) => {\r
    if (oldSet.has(n)) { shared += countNodes(n); return; } // reused subtree → all its nodes are shared\r
    copied++;\r
    for (const c of n.children) if (isNode(c)) walk(c);\r
  };\r
  walk(newRoot);\r
  return { shared, copied, total: shared + copied };\r
}\r
function countNodes(n: Node): number { let c = 1; for (const ch of n.children) if (isNode(ch)) c += countNodes(ch); return c; }\r
`;export{e as default};