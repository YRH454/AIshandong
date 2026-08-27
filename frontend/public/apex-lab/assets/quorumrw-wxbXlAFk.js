var e=`// Tunable quorum consistency (the Dynamo / Cassandra dial). Data is replicated to N\r
// nodes. A write must be acknowledged by W of them; a read must gather R of them. The\r
// single inequality that makes reads see the latest write is R + W > N: by pigeonhole,\r
// any set of R nodes and any set of W nodes out of N must share at least one node — and\r
// that shared node holds the freshest value. A second inequality, 2W > N, makes two\r
// concurrent writes always overlap, so there's a single ordering and no split-brain.\r
// Turning R and W up and down trades read latency for write latency for consistency.\r
// Pure and tested against the canonical Dynamo configurations.\r
\r
export interface Config { n: number; r: number; w: number }\r
\r
export interface Analysis {\r
  overlap: number;          // guaranteed read∩write nodes = max(0, R + W − N)\r
  strongRead: boolean;      // R + W > N  → a read always sees the latest ack'd write\r
  writeConflictFree: boolean; // 2W > N    → two writes always overlap (one order, no split-brain)\r
  readLoad: number;         // nodes touched per read\r
  writeLoad: number;        // nodes touched per write\r
  profile: string;\r
}\r
\r
export function analyze({ n, r, w }: Config): Analysis {\r
  const overlap = Math.max(0, r + w - n);\r
  const strongRead = r + w > n;\r
  const writeConflictFree = 2 * w > n;\r
  let profile: string;\r
  if (!strongRead) profile = 'Eventually consistent — fast everywhere, but a read may miss a recent write.';\r
  else if (w >= n) profile = 'Read-optimized — reads are cheap (small R), but a single down node blocks writes.';\r
  else if (r === 1) profile = 'Read-optimized — R=1 reads are fastest; writes pay the larger W.';\r
  else if (w === 1) profile = 'Write-optimized — W=1 writes are fastest; reads pay the larger R.';\r
  else profile = 'Balanced — majority R and W (the common default), tolerant and strongly consistent.';\r
  return { overlap, strongRead, writeConflictFree, readLoad: r, writeLoad: w, profile };\r
}\r
\r
/** Does a concrete read set intersect a concrete write set? (Pigeonhole guarantees yes\r
 *  whenever R + W > N, regardless of which nodes were chosen.) */\r
export function intersects(readSet: number[], writeSet: number[]): number[] {\r
  const w = new Set(writeSet);\r
  return readSet.filter((n) => w.has(n));\r
}\r
\r
/** The adversarial worst case: push the read window as far from the write window as\r
 *  possible on a ring of N nodes, and report the forced overlap. */\r
export function worstCase({ n, r, w }: Config): { writeSet: number[]; readSet: number[]; shared: number[] } {\r
  const writeSet = Array.from({ length: w }, (_, i) => i);\r
  // start the read window at the highest indices, wrapping — minimises deliberate overlap\r
  const readSet = Array.from({ length: r }, (_, i) => (n - 1 - i + n) % n).sort((a, b) => a - b);\r
  return { writeSet, readSet, shared: intersects(readSet, writeSet) };\r
}\r
`;export{e as default};