var e=`// Segment tree — answer range queries (here, the MINIMUM over any sub-range) and point\r
// updates, both in O(log n). It's a binary tree over the array: each leaf is one element,\r
// each internal node summarizes its two children's range (the smaller of the two minima).\r
// A query for [l, r] descends from the root, taking whole nodes that fall entirely inside\r
// the range and recursing only where the range straddles a boundary — touching O(log n)\r
// nodes. An update fixes one leaf and walks up re-combining its ancestors. Unlike a Fenwick\r
// tree (which only does invertible operations like sum), a segment tree handles min/max and,\r
// with lazy propagation, range updates too. Pure, tested against brute force.\r
\r
const INF = Infinity;\r
\r
export interface SegTree { n: number; tree: number[] } // 1-indexed implicit tree, size 2n (n a power of 2)\r
\r
export function build(values: number[]): SegTree {\r
  let n = 1; while (n < values.length) n *= 2;        // round up to a power of two\r
  const tree = new Array(2 * n).fill(INF);\r
  for (let i = 0; i < values.length; i++) tree[n + i] = values[i]; // leaves\r
  for (let i = n - 1; i >= 1; i--) tree[i] = Math.min(tree[2 * i], tree[2 * i + 1]); // internal mins\r
  return { n, tree };\r
}\r
\r
/** Minimum over the inclusive range [l, r]. Records the tree nodes that contributed. */\r
export function queryMin(s: SegTree, l: number, r: number): { min: number; nodes: number[] } {\r
  const nodes: number[] = [];\r
  let lo = l + s.n, hi = r + s.n + 1; // half-open [lo, hi) on the leaf row\r
  let min = INF;\r
  while (lo < hi) {\r
    if (lo & 1) { min = Math.min(min, s.tree[lo]); nodes.push(lo); lo++; } // lo is a right child → take it\r
    if (hi & 1) { hi--; min = Math.min(min, s.tree[hi]); nodes.push(hi); } // hi-1 is a left child → take it\r
    lo >>= 1; hi >>= 1;\r
  }\r
  return { min, nodes };\r
}\r
\r
/** Set element i to value, re-combining its ancestors up to the root. */\r
export function update(s: SegTree, i: number, value: number): number[] {\r
  let p = i + s.n;\r
  s.tree[p] = value;\r
  const path = [p];\r
  for (p >>= 1; p >= 1; p >>= 1) { s.tree[p] = Math.min(s.tree[2 * p], s.tree[2 * p + 1]); path.push(p); }\r
  return path;\r
}\r
\r
/** Brute-force min, for cross-checking. */\r
export const naiveMin = (values: number[], l: number, r: number): number => Math.min(...values.slice(l, r + 1));\r
\r
/** The depth (levels) of the tree. */\r
export const depth = (s: SegTree): number => Math.log2(s.n) + 1;\r
\r
// ---- lazy propagation: range UPDATE + range query ----------------------------------------------\r
// The point-update tree above can't add a value to a whole range without touching every element.\r
// Lazy propagation fixes that: when a range-add fully covers a node, we stamp the node's min and\r
// park the delta in a LAZY tag instead of recursing into its children. The tag is only "pushed\r
// down" later, the next time a query or update actually needs to descend through that node. So a\r
// range-add over any [l, r] tags only O(log n) nodes — the same handful a query touches.\r
\r
export interface LazyTree { n: number; min: number[]; lazy: number[] } // recursive tree, node-indexed (4n)\r
\r
export function buildLazy(values: number[]): LazyTree {\r
  const n = values.length;\r
  const t: LazyTree = { n, min: new Array(4 * Math.max(1, n)).fill(0), lazy: new Array(4 * Math.max(1, n)).fill(0) };\r
  const rec = (node: number, lo: number, hi: number) => {\r
    if (lo === hi) { t.min[node] = values[lo]; return; }\r
    const mid = (lo + hi) >> 1;\r
    rec(2 * node, lo, mid); rec(2 * node + 1, mid + 1, hi);\r
    t.min[node] = Math.min(t.min[2 * node], t.min[2 * node + 1]);\r
  };\r
  if (n > 0) rec(1, 0, n - 1);\r
  return t;\r
}\r
\r
function pushDown(t: LazyTree, node: number): void {\r
  const d = t.lazy[node];\r
  if (d !== 0) {\r
    for (const c of [2 * node, 2 * node + 1]) { t.min[c] += d; t.lazy[c] += d; }\r
    t.lazy[node] = 0;\r
  }\r
}\r
\r
/** Add \`delta\` to every element in [l, r]. Returns the node ids that absorbed the change as a\r
 *  lazy tag (the O(log n) "frontier" — proof that we did NOT touch every covered leaf). */\r
export function rangeAdd(t: LazyTree, l: number, r: number, delta: number): number[] {\r
  const tagged: number[] = [];\r
  const rec = (node: number, lo: number, hi: number) => {\r
    if (r < lo || hi < l) return; // disjoint\r
    if (l <= lo && hi <= r) { t.min[node] += delta; t.lazy[node] += delta; tagged.push(node); return; } // fully covered → tag, stop\r
    pushDown(t, node);\r
    const mid = (lo + hi) >> 1;\r
    rec(2 * node, lo, mid); rec(2 * node + 1, mid + 1, hi);\r
    t.min[node] = Math.min(t.min[2 * node], t.min[2 * node + 1]);\r
  };\r
  if (t.n > 0) rec(1, 0, t.n - 1);\r
  return tagged;\r
}\r
\r
/** Minimum over [l, r], pushing lazy tags down along the way. */\r
export function queryLazy(t: LazyTree, l: number, r: number): number {\r
  const rec = (node: number, lo: number, hi: number): number => {\r
    if (r < lo || hi < l) return INF;\r
    if (l <= lo && hi <= r) return t.min[node];\r
    pushDown(t, node);\r
    const mid = (lo + hi) >> 1;\r
    return Math.min(rec(2 * node, lo, mid), rec(2 * node + 1, mid + 1, hi));\r
  };\r
  return t.n > 0 ? rec(1, 0, t.n - 1) : INF;\r
}\r
\r
/** Materialize the current element values (each is a single-point query). */\r
export const toArray = (t: LazyTree): number[] => Array.from({ length: t.n }, (_, i) => queryLazy(t, i, i));\r
`;export{e as default};