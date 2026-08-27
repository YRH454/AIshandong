var e=`// Voronoi diagram — carve a plane into territories, one per "site," where every point belongs to whichever site\r
// is NEAREST. That single rule ("go to your closest post office / cell tower / seed crystal") produces the\r
// honeycomb of convex cells you see in cracked mud, giraffe coats, foam, and crystal grains, and it's one of the\r
// most reused structures in computing: nearest-neighbor lookup, mesh generation, coverage and facility-location\r
// planning, procedural textures, and motion planning all lean on it. The boundary between two neighboring cells\r
// is the PERPENDICULAR BISECTOR of the segment joining their sites — the set of points equidistant to both — so\r
// every cell is an intersection of half-planes and therefore convex (under the Euclidean metric). The Voronoi\r
// diagram is also the exact DUAL of the Delaunay triangulation: connect two sites whenever their cells touch and\r
// you get the triangulation that maximizes the smallest angle. Fortune's sweepline algorithm builds it in\r
// O(n log n), but the DEFINITION is just "nearest site," which is what this models directly (an exact\r
// assignment). Swapping the distance metric reshapes the cells: straight-line (Euclidean) gives bisector edges,\r
// Manhattan (taxicab) and Chebyshev (chessboard-king) give blocky diamond/square cells — the same partition rule,\r
// a different notion of "near." Reference: Voronoi (1908); Fortune's algorithm, SoCG (1986).\r
\r
export type Metric = 'euclidean' | 'manhattan' | 'chebyshev';\r
export interface Site { x: number; y: number }\r
\r
/** Distance under the chosen metric (Euclidean returns squared distance — fine for nearest-site comparisons). */\r
export function dist(m: Metric, ax: number, ay: number, bx: number, by: number): number {\r
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);\r
  if (m === 'manhattan') return dx + dy;\r
  if (m === 'chebyshev') return Math.max(dx, dy);\r
  return dx * dx + dy * dy; // euclidean (squared — monotonic, so nearest is preserved)\r
}\r
\r
/** Index of the nearest site to (x,y); ties resolve to the lowest index (deterministic boundaries). */\r
export function nearestSite(sites: Site[], x: number, y: number, m: Metric = 'euclidean'): number {\r
  let best = -1, bestD = Infinity;\r
  for (let i = 0; i < sites.length; i++) {\r
    const d = dist(m, x, y, sites[i].x, sites[i].y);\r
    if (d < bestD) { bestD = d; best = i; }\r
  }\r
  return best;\r
}\r
\r
/** Assign every grid point to its nearest site — the Voronoi diagram as a label grid. */\r
export function voronoiGrid(sites: Site[], cols: number, rows: number, m: Metric = 'euclidean'): Int16Array {\r
  const g = new Int16Array(cols * rows);\r
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) g[y * cols + x] = nearestSite(sites, x, y, m);\r
  return g;\r
}\r
`;export{e as default};