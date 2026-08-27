var e=`// k-d tree — a binary tree that indexes points in k-dimensional space so you can find the NEAREST neighbour\r
// without checking every point. In 2-D it recursively splits the plane: the root splits on x (a vertical\r
// line), its children split on y (horizontal lines), grandchildren on x again, alternating down the tree.\r
// Each node owns a rectangular region. A nearest-neighbour query walks down to the leaf whose region contains\r
// the query, then backtracks — but here's the trick that makes it sub-linear: at each node it only descends\r
// the FAR subtree if the splitting line is closer than the best point found so far. Whole regions get pruned\r
// untouched. It powers spatial databases, graphics (ray tracing, collision), k-NN in machine learning, and\r
// geospatial "what's near me". (It degrades in very high dimensions — the curse of dimensionality — where\r
// approximate methods take over.) Reference: Bentley (1975).\r
\r
export interface Point { x: number; y: number }\r
export interface KdNode { point: Point; axis: 0 | 1; left: KdNode | null; right: KdNode | null }\r
\r
const coord = (p: Point, axis: 0 | 1) => (axis === 0 ? p.x : p.y);\r
const dist2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;\r
\r
/** Build a balanced 2-D k-d tree: sort by the current axis, take the median as the node, recurse, alternating\r
 *  the split axis each level. */\r
export function build(points: Point[], depth = 0): KdNode | null {\r
  if (points.length === 0) return null;\r
  const axis: 0 | 1 = (depth % 2) as 0 | 1;\r
  const sorted = [...points].sort((a, b) => coord(a, axis) - coord(b, axis));\r
  const mid = Math.floor(sorted.length / 2);\r
  return {\r
    point: sorted[mid], axis,\r
    left: build(sorted.slice(0, mid), depth + 1),\r
    right: build(sorted.slice(mid + 1), depth + 1),\r
  };\r
}\r
\r
export interface NearestResult { point: Point | null; dist: number; visited: number }\r
\r
/** Nearest-neighbour search with plane pruning. \`visited\` counts nodes examined — compare it to the total\r
 *  point count to see how much the pruning saved versus a brute-force scan. */\r
export function nearest(root: KdNode | null, q: Point): NearestResult {\r
  let best: Point | null = null, bestD2 = Infinity, visited = 0;\r
  const go = (node: KdNode | null) => {\r
    if (!node) return;\r
    visited++;\r
    const d2 = dist2(node.point, q);\r
    if (d2 < bestD2) { bestD2 = d2; best = node.point; }\r
    const diff = coord(q, node.axis) - coord(node.point, node.axis); // signed distance to the splitting line\r
    const near = diff < 0 ? node.left : node.right;\r
    const far = diff < 0 ? node.right : node.left;\r
    go(near);\r
    if (diff * diff < bestD2) go(far); // only cross the plane if it could hold something closer\r
  };\r
  go(root);\r
  return { point: best, dist: Math.sqrt(bestD2), visited };\r
}\r
\r
/** Brute-force nearest — the ground truth to check the tree against. */\r
export function bruteNearest(points: Point[], q: Point): NearestResult {\r
  let best: Point | null = null, bestD2 = Infinity;\r
  for (const p of points) { const d2 = dist2(p, q); if (d2 < bestD2) { bestD2 = d2; best = p; } }\r
  return { point: best, dist: Math.sqrt(bestD2), visited: points.length };\r
}\r
`;export{e as default};