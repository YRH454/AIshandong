var e=`// Chord (Stoica et al., 2001) — a distributed hash table that finds which node owns a key\r
// in O(log n) hops, not O(n). Nodes and keys are hashed onto a ring of 2^m identifiers; a\r
// key is owned by its SUCCESSOR (the first node clockwise from it). Naively you'd walk\r
// node-to-node around the ring, but each node also keeps a FINGER TABLE: shortcuts to the\r
// successors of n+1, n+2, n+4, … n+2^(m-1), so a lookup can leap halfway to the target each\r
// hop, halving the remaining distance — O(log n). This is how P2P systems (and Cassandra's\r
// ring) route without any node knowing the whole membership. Pure, tested on the classic\r
// m=3 example.\r
\r
export interface Ring { m: number; size: number; nodes: number[] } // nodes sorted ascending\r
\r
export const create = (m: number, nodes: number[]): Ring =>\r
  ({ m, size: 1 << m, nodes: [...new Set(nodes)].sort((a, b) => a - b) });\r
\r
/** Is x in the circular interval (a, b] (or [a,b) etc.) on the ring? */\r
function inInterval(x: number, a: number, b: number, incLeft: boolean, incRight: boolean, size: number): boolean {\r
  x = ((x % size) + size) % size; a = ((a % size) + size) % size; b = ((b % size) + size) % size;\r
  if (a === b) return incLeft || incRight || x === a; // full circle\r
  if (a < b) return (incLeft ? x >= a : x > a) && (incRight ? x <= b : x < b);\r
  return (incLeft ? x >= a : x > a) || (incRight ? x <= b : x < b); // wraps past 0\r
}\r
\r
/** The node responsible for an identifier = first node clockwise at or after it. */\r
export function responsible(ring: Ring, id: number): number {\r
  id = ((id % ring.size) + ring.size) % ring.size;\r
  for (const n of ring.nodes) if (n >= id) return n;\r
  return ring.nodes[0]; // wrapped past the top\r
}\r
\r
/** The next node clockwise from a node (its successor pointer). */\r
export function nextNode(ring: Ring, n: number): number {\r
  const i = ring.nodes.indexOf(n);\r
  return ring.nodes[(i + 1) % ring.nodes.length];\r
}\r
\r
/** Finger table of node n: finger[i] = responsible(n + 2^i). */\r
export function fingerTable(ring: Ring, n: number): { start: number; node: number }[] {\r
  return Array.from({ length: ring.m }, (_, i) => {\r
    const start = (n + (1 << i)) % ring.size;\r
    return { start, node: responsible(ring, start) };\r
  });\r
}\r
\r
/** Closest finger of n that precedes \`key\` on the ring (the longest safe leap). */\r
function closestPreceding(ring: Ring, n: number, key: number): number {\r
  const fingers = fingerTable(ring, n);\r
  for (let i = fingers.length - 1; i >= 0; i--) {\r
    const f = fingers[i].node;\r
    if (f !== n && inInterval(f, n, key, false, false, ring.size)) return f;\r
  }\r
  return n;\r
}\r
\r
export interface Lookup { target: number; hops: number[] }\r
\r
/** Route a lookup for \`key\` starting at \`start\`, returning the owner and the hop path. */\r
export function lookup(ring: Ring, start: number, key: number): Lookup {\r
  // the start node itself owns the key if it falls in (predecessor, start]\r
  const si = ring.nodes.indexOf(start);\r
  const pred = ring.nodes[(si - 1 + ring.nodes.length) % ring.nodes.length];\r
  if (inInterval(key, pred, start, false, true, ring.size)) return { target: start, hops: [start] };\r
\r
  const hops = [start];\r
  let cur = start;\r
  for (let guard = 0; guard < ring.nodes.length + ring.m + 2; guard++) {\r
    const succ = nextNode(ring, cur);\r
    if (inInterval(key, cur, succ, false, true, ring.size)) return { target: succ, hops };\r
    const next = closestPreceding(ring, cur, key);\r
    if (next === cur) return { target: succ, hops }; // no closer finger\r
    cur = next; hops.push(cur);\r
  }\r
  return { target: responsible(ring, key), hops };\r
}\r
`;export{e as default};