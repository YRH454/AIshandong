var e=`// Dijkstra's shortest-path algorithm with a recorded step trace, so the UI can\r
// animate exactly what a link-state router (OSPF, IS-IS) does: flood the link\r
// costs, then each router independently computes the lowest-cost tree to every\r
// destination. The math is real and tested against known weighted graphs.\r
\r
export interface Edge { a: string; b: string; cost: number }\r
export interface Graph { nodes: string[]; edges: Edge[] }\r
\r
/** One relaxation step, captured for visualization. */\r
export interface DijkstraStep {\r
  settled: string; // the node whose shortest distance just became final\r
  dist: Record<string, number>; // best-known distance to every node after this step\r
  prev: Record<string, string | null>; // predecessor on the best path\r
  relaxed: string[]; // neighbours whose tentative distance improved this step\r
}\r
\r
export interface DijkstraResult {\r
  dist: Record<string, number>;\r
  prev: Record<string, string | null>;\r
  steps: DijkstraStep[];\r
  order: string[]; // the order nodes were settled\r
}\r
\r
function neighbours(g: Graph, node: string): { to: string; cost: number }[] {\r
  const out: { to: string; cost: number }[] = [];\r
  for (const e of g.edges) {\r
    if (e.a === node) out.push({ to: e.b, cost: e.cost });\r
    else if (e.b === node) out.push({ to: e.a, cost: e.cost }); // links are bidirectional\r
  }\r
  return out;\r
}\r
\r
/** Run Dijkstra from \`source\`, returning final distances plus a per-settle trace. */\r
export function dijkstra(g: Graph, source: string): DijkstraResult {\r
  const dist: Record<string, number> = {};\r
  const prev: Record<string, string | null> = {};\r
  const done: Record<string, boolean> = {};\r
  for (const n of g.nodes) { dist[n] = Infinity; prev[n] = null; }\r
  dist[source] = 0;\r
\r
  const steps: DijkstraStep[] = [];\r
  const order: string[] = [];\r
\r
  while (true) {\r
    // pick the unsettled node with the smallest tentative distance\r
    let u: string | null = null;\r
    let best = Infinity;\r
    for (const n of g.nodes) {\r
      if (!done[n] && dist[n] < best) { best = dist[n]; u = n; }\r
    }\r
    if (u === null) break; // all reachable nodes settled\r
    done[u] = true;\r
    order.push(u);\r
\r
    const relaxed: string[] = [];\r
    for (const { to, cost } of neighbours(g, u)) {\r
      if (done[to]) continue;\r
      const alt = dist[u] + cost;\r
      if (alt < dist[to]) { dist[to] = alt; prev[to] = u; relaxed.push(to); }\r
    }\r
    steps.push({ settled: u, dist: { ...dist }, prev: { ...prev }, relaxed });\r
  }\r
\r
  return { dist, prev, steps, order };\r
}\r
\r
/** Reconstruct the shortest path source→target from a result's predecessors. */\r
export function shortestPath(result: DijkstraResult, source: string, target: string): string[] | null {\r
  if (result.dist[target] === Infinity) return null; // unreachable\r
  const path: string[] = [];\r
  let cur: string | null = target;\r
  while (cur !== null) {\r
    path.unshift(cur);\r
    if (cur === source) return path;\r
    cur = result.prev[cur] ?? null;\r
  }\r
  return path[0] === source ? path : null;\r
}\r
\r
/** The set of undirected edges that make up a path, as "a|b" keys (a<b sorted). */\r
export function pathEdgeKeys(path: string[]): Set<string> {\r
  const keys = new Set<string>();\r
  for (let i = 0; i + 1 < path.length; i++) {\r
    const [a, b] = [path[i], path[i + 1]].sort();\r
    keys.add(\`\${a}|\${b}\`);\r
  }\r
  return keys;\r
}\r
`;export{e as default};