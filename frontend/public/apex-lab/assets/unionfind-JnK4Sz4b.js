var e=`// Union-Find (Disjoint Set Union) — the data structure that answers "are these two things\r
// in the same group?" in almost O(1), and merges two groups just as fast. Each element\r
// points at a parent; following parents up reaches a root that names the set. Two\r
// optimizations make it near-constant: UNION BY RANK attaches the shorter tree under the\r
// taller (keeping trees flat), and PATH COMPRESSION re-points every node visited during a\r
// find straight at the root. Together they give the inverse-Ackermann bound — effectively\r
// constant. It powers Kruskal's minimum-spanning-tree, network-connectivity checks, and\r
// image segmentation. Pure, tested.\r
\r
export interface DSU { parent: number[]; rank: number[]; count: number }\r
\r
export const create = (n: number): DSU => ({ parent: Array.from({ length: n }, (_, i) => i), rank: new Array(n).fill(0), count: n });\r
\r
/** Find the set's root, compressing the path so future finds are O(1). */\r
export function find(dsu: DSU, x: number): number {\r
  const path: number[] = [];\r
  let root = x;\r
  while (dsu.parent[root] !== root) { path.push(root); root = dsu.parent[root]; }\r
  for (const node of path) dsu.parent[node] = root; // path compression\r
  return root;\r
}\r
\r
export interface UnionResult { merged: boolean; root: number }\r
\r
/** Merge the sets containing x and y, attaching the shorter tree under the taller. */\r
export function union(dsu: DSU, x: number, y: number): UnionResult {\r
  let rx = find(dsu, x), ry = find(dsu, y);\r
  if (rx === ry) return { merged: false, root: rx }; // already together\r
  if (dsu.rank[rx] < dsu.rank[ry]) [rx, ry] = [ry, rx]; // rx is the taller (or equal) root\r
  dsu.parent[ry] = rx;\r
  if (dsu.rank[rx] === dsu.rank[ry]) dsu.rank[rx]++; // equal ranks → result is one taller\r
  dsu.count--;\r
  return { merged: true, root: rx };\r
}\r
\r
export const connected = (dsu: DSU, x: number, y: number): boolean => find(dsu, x) === find(dsu, y);\r
\r
/** Group elements by their current root (for display). */\r
export function groups(dsu: DSU): Record<number, number[]> {\r
  const g: Record<number, number[]> = {};\r
  for (let i = 0; i < dsu.parent.length; i++) { const r = find(dsu, i); (g[r] ??= []).push(i); }\r
  return g;\r
}\r
`;export{e as default};