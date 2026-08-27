var e=`// Floyd-Warshall — shortest paths between EVERY pair of vertices, in one cubic dynamic program. The\r
// idea is a single relaxation rule applied for each "intermediate" vertex k in turn: the shortest path\r
// from i to j using only {0..k} as waypoints is either the best you had using {0..k-1}, or the best\r
// path i→k spliced onto k→j. Run k over all vertices and the table holds every shortest distance. It\r
// handles negative edges (unlike Dijkstra) and detects a negative cycle as a vertex whose distance to\r
// itself drops below zero. Reference: CLRS ch.25.2; Floyd 1962, Warshall 1962.\r
\r
export type Matrix = number[][];\r
export interface DiEdge { from: string; to: string; w: number }\r
export interface FloydResult { nodes: string[]; steps: { k: number | null; dist: Matrix }[]; dist: Matrix; negativeCycle: boolean }\r
\r
export function nodesOf(edges: DiEdge[], extra: string[] = []): string[] {\r
  const s = new Set<string>(extra);\r
  for (const e of edges) { s.add(e.from); s.add(e.to); }\r
  return [...s].sort();\r
}\r
\r
const clone = (m: Matrix): Matrix => m.map((r) => [...r]);\r
\r
export function floydWarshall(edges: DiEdge[], extra: string[] = []): FloydResult {\r
  const nodes = nodesOf(edges, extra);\r
  const idx: Record<string, number> = Object.fromEntries(nodes.map((n, i) => [n, i]));\r
  const n = nodes.length;\r
  const dist: Matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));\r
  for (const e of edges) dist[idx[e.from]][idx[e.to]] = Math.min(dist[idx[e.from]][idx[e.to]], e.w); // keep the cheapest parallel edge\r
\r
  const steps: { k: number | null; dist: Matrix }[] = [{ k: null, dist: clone(dist) }];\r
  for (let k = 0; k < n; k++) {\r
    for (let i = 0; i < n; i++) {\r
      if (dist[i][k] === Infinity) continue;\r
      for (let j = 0; j < n; j++) {\r
        const through = dist[i][k] + dist[k][j];\r
        if (through < dist[i][j]) dist[i][j] = through;\r
      }\r
    }\r
    steps.push({ k, dist: clone(dist) });\r
  }\r
  const negativeCycle = nodes.some((_, i) => dist[i][i] < 0);\r
  return { nodes, steps, dist, negativeCycle };\r
}\r
`;export{e as default};