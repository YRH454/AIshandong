var e=`// Fenwick tree / Binary Indexed Tree (Fenwick, 1994) — keep a running array where BOTH\r
// "add to element i" and "sum of the first i elements" cost O(log n), instead of one being\r
// O(1) and the other O(n). The trick is binary: tree[i] stores the sum of a block of\r
// elements ending at i whose LENGTH is the lowest set bit of i (i & −i). To update, you\r
// climb to every block that covers i by repeatedly adding that low bit; to take a prefix\r
// sum, you descend by repeatedly stripping it. So each operation touches only ~log n blocks\r
// — one per set bit. It's the structure behind range-sum queries, order statistics, and\r
// many competitive-programming and database aggregates. Pure, tested.\r
\r
export interface Fenwick { n: number; tree: number[] } // 1-indexed; tree[0] unused\r
\r
export function build(values: number[]): Fenwick {\r
  const n = values.length;\r
  const f: Fenwick = { n, tree: new Array(n + 1).fill(0) };\r
  values.forEach((v, i) => update(f, i + 1, v));\r
  return f;\r
}\r
\r
/** Add \`delta\` to element \`i\` (1-indexed), climbing to every covering block. */\r
export function update(f: Fenwick, i: number, delta: number): number[] {\r
  const touched: number[] = [];\r
  for (; i <= f.n; i += i & -i) { f.tree[i] += delta; touched.push(i); }\r
  return touched; // the indices visited (for the visualization)\r
}\r
\r
/** Prefix sum of elements 1..i, descending by stripping the low bit each step. */\r
export function query(f: Fenwick, i: number): { sum: number; visited: number[] } {\r
  let sum = 0; const visited: number[] = [];\r
  for (; i > 0; i -= i & -i) { sum += f.tree[i]; visited.push(i); }\r
  return { sum, visited };\r
}\r
\r
export const rangeQuery = (f: Fenwick, l: number, r: number): number => query(f, r).sum - query(f, l - 1).sum;\r
\r
/** The block each tree node is responsible for: [i − lowbit + 1 .. i]. */\r
export const responsibility = (i: number): [number, number] => [i - (i & -i) + 1, i];\r
`;export{e as default};