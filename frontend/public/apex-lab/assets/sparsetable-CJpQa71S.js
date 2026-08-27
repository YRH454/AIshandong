var e=`// Sparse table — a data structure that answers "what's the minimum in range [l, r]?" in O(1) time after an\r
// O(n log n) precompute, for a STATIC array. A segment tree also does range-min, but in O(log n) per query and\r
// with support for updates; if your array never changes (and many don't — a precomputed cost map, a\r
// sparse-index over an immutable column), you can do better. The idea leans on one special property of MIN\r
// (and max, gcd, AND, OR): it's IDEMPOTENT — min(x, x) = x — so overlapping two ranges that together cover\r
// [l, r] gives the right answer even though they double-count the middle. Precompute, for every position i and\r
// every power of two 2^k, the minimum of the block starting at i of length 2^k: table[k][i] = min of\r
// a[i .. i+2^k-1]. Each level is built from the one below in O(1) per cell (a block of length 2^k is two blocks\r
// of length 2^(k-1)). Then ANY query [l, r] is covered by exactly two of these power-of-two blocks — one\r
// anchored at l, one ending at r — that overlap in the middle: pick k = ⌊log2(r-l+1)⌋ and return\r
// min(table[k][l], table[k][r-2^k+1]). Two array lookups, one min, done — no loop over the range. Reference:\r
// Bender & Farach-Colton, "The LCA Problem Revisited" (the sparse-table RMQ); a staple of competitive\r
// programming and read-only analytics indexes.\r
\r
/** Build the sparse table: table[k][i] = min of a[i .. i+2^k-1]. */\r
export function build(a: number[]): number[][] {\r
  const n = a.length;\r
  if (n === 0) return [];\r
  const K = Math.floor(Math.log2(n)) + 1;\r
  const table: number[][] = [a.slice()];\r
  for (let k = 1; k < K; k++) {\r
    const half = 1 << (k - 1);\r
    const len = 1 << k;\r
    const row: number[] = [];\r
    for (let i = 0; i + len <= n; i++) row[i] = Math.min(table[k - 1][i], table[k - 1][i + half]);\r
    table[k] = row;\r
  }\r
  return table;\r
}\r
\r
/** O(1) range-minimum query over the inclusive range [l, r]. Returns the two blocks used, for visualization. */\r
export function query(table: number[][], l: number, r: number): { value: number; k: number; blocks: [number, number] } {\r
  const k = Math.floor(Math.log2(r - l + 1));\r
  const lo = l, hi = r - (1 << k) + 1;             // two length-2^k blocks that together cover [l, r]\r
  return { value: Math.min(table[k][lo], table[k][hi]), k, blocks: [lo, hi] };\r
}\r
\r
/** Brute-force range minimum — the ground truth. */\r
export function brute(a: number[], l: number, r: number): number {\r
  let m = a[l];\r
  for (let i = l + 1; i <= r; i++) m = Math.min(m, a[i]);\r
  return m;\r
}\r
`;export{e as default};