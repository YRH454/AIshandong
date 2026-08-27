var e=`// Read-repair & anti-entropy — how a Dynamo-style replicated store heals divergence without a leader.\r
// Replicas drift apart (a write missed some nodes during a partition). Two mechanisms reconcile them:\r
//   • READ-REPAIR (synchronous, on the hot path): a quorum read gathers R copies; if their versions\r
//     disagree, the coordinator returns the newest and writes it back to the stale replicas it saw.\r
//     Cheap, but only fixes keys that are actually read.\r
//   • ANTI-ENTROPY (background): two replicas compare MERKLE TREES of their whole keyspace. Equal\r
//     roots ⇒ identical, in one comparison. Differing roots ⇒ recurse only into the subtrees whose\r
//     hashes differ, walking down to the exact divergent keys in O(log n) work per difference instead\r
//     of shipping and comparing every key. This is how Cassandra/Riak/DynamoDB repair replicas.\r
// Real deterministic hashing (FNV-1a + a node combiner); production uses SHA-256. Pure, tested.\r
\r
// ---- read-repair --------------------------------------------------------------------------------\r
\r
export interface Replica { id: string; value: string; version: number }\r
export interface ReadResult { winner: string; winningVersion: number; stale: string[]; repaired: boolean }\r
\r
/** A quorum read over the first R replicas: newest version wins, older replicas are repaired. */\r
export function quorumRead(replicas: Replica[], R: number): ReadResult {\r
  const quorum = replicas.slice(0, R);\r
  if (quorum.length === 0) return { winner: '', winningVersion: -1, stale: [], repaired: false }; // no replicas answered\r
  const newest = quorum.reduce((a, b) => (b.version > a.version ? b : a));\r
  const stale = quorum.filter((r) => r.version < newest.version).map((r) => r.id);\r
  return { winner: newest.value, winningVersion: newest.version, stale, repaired: stale.length > 0 };\r
}\r
\r
// ---- anti-entropy via Merkle trees --------------------------------------------------------------\r
\r
export interface MerkleNode { hash: number; lo: number; hi: number; left?: MerkleNode; right?: MerkleNode }\r
\r
const fnv1a = (s: string): number => {\r
  let h = 0x811c9dc5;\r
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }\r
  return h >>> 0;\r
};\r
const combine = (l: number, r: number): number => (Math.imul(l ^ r, 0x01000193) ^ ((l + r) >>> 0)) >>> 0;\r
\r
/** Per-key content hash (the Merkle leaves) — the keyspace, padded to a power of two. */\r
export function leafHashes(values: string[]): number[] {\r
  let n = 1; while (n < values.length) n *= 2;\r
  const out = new Array(n).fill(0);\r
  for (let i = 0; i < values.length; i++) out[i] = fnv1a(values[i]);\r
  return out;\r
}\r
\r
export function buildMerkle(leaves: number[]): MerkleNode {\r
  const build = (lo: number, hi: number): MerkleNode => {\r
    if (lo === hi) return { hash: leaves[lo], lo, hi };\r
    const mid = (lo + hi) >> 1;\r
    const left = build(lo, mid), right = build(mid + 1, hi);\r
    return { hash: combine(left.hash, right.hash), lo, hi, left, right };\r
  };\r
  return build(0, leaves.length - 1);\r
}\r
\r
export interface DiffResult { differingLeaves: number[]; comparisons: number }\r
\r
/** Compare two Merkle trees, recursing only where hashes differ. Returns the divergent leaf indices\r
 *  and how many node comparisons it took (vs comparing all n leaves outright). */\r
export function merkleDiff(a: MerkleNode, b: MerkleNode): DiffResult {\r
  // the lockstep recursion assumes identical tree shape; if two replicas built trees over different\r
  // key counts (different depth), conservatively flag the whole covered range rather than mispair nodes.\r
  if (a.lo !== b.lo || a.hi !== b.hi) {\r
    const lo = Math.min(a.lo, b.lo), hi = Math.max(a.hi, b.hi);\r
    return { differingLeaves: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), comparisons: 1 };\r
  }\r
  const differingLeaves: number[] = [];\r
  let comparisons = 0;\r
  const rec = (na: MerkleNode, nb: MerkleNode) => {\r
    comparisons++;\r
    if (na.hash === nb.hash) return; // whole subtree matches — skip it entirely\r
    if (!na.left || !nb.left) { differingLeaves.push(na.lo); return; } // a divergent leaf\r
    rec(na.left, nb.left); rec(na.right!, nb.right!);\r
  };\r
  rec(a, b);\r
  return { differingLeaves, comparisons };\r
}\r
`;export{e as default};