var e=`// Kademlia — the distributed hash table that actually runs the decentralized internet: BitTorrent's Mainline\r
// DHT, IPFS, Ethereum's node discovery, and I2P all use it. Like any DHT it maps keys to the nodes responsible\r
// for them across a peer-to-peer network with no central directory, and lets any node find the node closest to\r
// a key in O(log n) hops while knowing only O(log n) peers. Kademlia's trick is its distance metric: the\r
// "distance" between two IDs is their bitwise XOR, read as a number. XOR distance is symmetric (d(a,b)=d(b,a))\r
// and, crucially, has a tree structure — two IDs are close exactly when they share a long binary PREFIX. That\r
// lets every node organize its contacts into k-BUCKETS: bucket i holds up to k peers whose XOR distance falls\r
// in [2^i, 2^{i+1}), i.e. peers that first differ from you at bit i. You know many nearby peers and\r
// exponentially fewer distant ones — O(log n) contacts total. To look up a target key, you ask the α closest\r
// peers you know; each replies with the closest peers IT knows; you keep the overall-closest and repeat,\r
// halving the remaining distance each round until it converges on the node nearest the key. Because XOR is a\r
// proper metric with the prefix property, each hop fixes another leading bit and the search provably converges.\r
// This models IDs, XOR distance, k-bucket routing tables, and the iterative lookup. Reference: Maymounkov &\r
// Mazières, "Kademlia" (2002).\r
\r
export const BITS = 8; // ID space 0..255 for legibility (real Kademlia uses 160)\r
\r
export const distance = (a: number, b: number): number => (a ^ b) >>> 0;\r
\r
/** Which k-bucket a peer falls in, relative to \`node\`: the position of the highest set bit of the XOR distance. */\r
export function bucketIndex(node: number, peer: number): number {\r
  const d = distance(node, peer);\r
  return d === 0 ? -1 : 31 - Math.clz32(d);\r
}\r
\r
/** Length of the shared leading-bit prefix of two IDs — longer prefix = closer. */\r
export function sharedPrefix(a: number, b: number): number {\r
  const d = distance(a, b);\r
  return d === 0 ? BITS : BITS - 1 - (31 - Math.clz32(d));\r
}\r
\r
/** A node's routing table: up to k peers per bucket, the k closest in each. */\r
export function routingTable(node: number, network: number[], k: number): number[] {\r
  const buckets = new Map<number, number[]>();\r
  for (const peer of network) {\r
    if (peer === node) continue;\r
    const bi = bucketIndex(node, peer);\r
    (buckets.get(bi) ?? buckets.set(bi, []).get(bi)!).push(peer);\r
  }\r
  const known: number[] = [];\r
  for (const peers of buckets.values()) {\r
    peers.sort((x, y) => distance(node, x) - distance(node, y));\r
    known.push(...peers.slice(0, k));\r
  }\r
  return known;\r
}\r
\r
export interface LookupResult { path: number[]; result: number; hops: number }\r
\r
/** Iterative lookup: repeatedly query the α closest-to-target known peers, merging their contacts, until the\r
 *  closest node stops improving. Returns the query path and the closest node found. */\r
export function lookup(network: number[], target: number, start: number, k: number, alpha = 3): LookupResult {\r
  const tables = new Map<number, number[]>();\r
  const tableOf = (n: number) => tables.get(n) ?? tables.set(n, routingTable(n, network, k)).get(n)!;\r
\r
  const known = new Set<number>([start, ...tableOf(start)]);\r
  const queried = new Set<number>();\r
  const path: number[] = [];\r
  let closest = [...known].reduce((a, b) => (distance(b, target) < distance(a, target) ? b : a), start);\r
\r
  for (;;) {\r
    const toQuery = [...known].filter((n) => !queried.has(n)).sort((a, b) => distance(a, target) - distance(b, target)).slice(0, alpha);\r
    if (toQuery.length === 0) break;\r
    for (const node of toQuery) { queried.add(node); path.push(node); for (const peer of tableOf(node)) known.add(peer); }\r
    const newClosest = [...known].reduce((a, b) => (distance(b, target) < distance(a, target) ? b : a), closest);\r
    if (distance(newClosest, target) >= distance(closest, target)) break; // no improvement → converged\r
    closest = newClosest;\r
  }\r
  return { path, result: closest, hops: path.length };\r
}\r
\r
/** The true nearest node to a target (ground truth). */\r
export const nearest = (network: number[], target: number): number =>\r
  network.reduce((a, b) => (distance(b, target) < distance(a, target) ? b : a));\r
`;export{e as default};