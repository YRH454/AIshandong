var e=`// Topological sort (Kahn's algorithm, 1962) — order the nodes of a directed graph so every\r
// edge points forward: if A must come before B (A → B), A appears earlier. It's how build\r
// systems decide compile order, how spreadsheets recalculate cells, how package managers\r
// resolve dependencies, and how schedulers sequence tasks. Kahn's method: repeatedly take a\r
// node with no remaining prerequisites (in-degree 0), append it, and remove its outgoing\r
// edges — exposing the next ready nodes. If some nodes never reach in-degree 0, the graph\r
// has a CYCLE and no ordering exists. Pure, tested (valid orderings + cycle detection).\r
\r
export interface Graph { nodes: string[]; edges: [string, string][] } // edge [a,b] means a before b\r
\r
export interface Step { picked: string; readyAfter: string[] }\r
export interface Result { order: string[] | null; hasCycle: boolean; cycleNodes: string[]; steps: Step[] }\r
\r
export function topoSort(g: Graph): Result {\r
  const indeg: Record<string, number> = {};\r
  const adj: Record<string, string[]> = {};\r
  for (const n of g.nodes) { indeg[n] = 0; adj[n] = []; }\r
  for (const [a, b] of g.edges) { adj[a].push(b); indeg[b]++; }\r
\r
  // ready set = in-degree 0; pick the alphabetically-smallest each time for a deterministic order\r
  const ready = g.nodes.filter((n) => indeg[n] === 0).sort();\r
  const order: string[] = [];\r
  const steps: Step[] = [];\r
\r
  while (ready.length) {\r
    const n = ready.shift()!;\r
    order.push(n);\r
    const newlyReady: string[] = [];\r
    for (const m of adj[n]) { if (--indeg[m] === 0) newlyReady.push(m); }\r
    for (const m of newlyReady.sort()) {\r
      // insert keeping \`ready\` sorted\r
      let i = 0; while (i < ready.length && ready[i] < m) i++;\r
      ready.splice(i, 0, m);\r
    }\r
    steps.push({ picked: n, readyAfter: [...ready] });\r
  }\r
\r
  if (order.length < g.nodes.length) {\r
    const cycleNodes = g.nodes.filter((n) => indeg[n] > 0); // never reached in-degree 0\r
    return { order: null, hasCycle: true, cycleNodes, steps };\r
  }\r
  return { order, hasCycle: false, cycleNodes: [], steps };\r
}\r
\r
/** Verify an ordering respects every edge (for testing / honesty). */\r
export function isValidOrder(g: Graph, order: string[]): boolean {\r
  const pos: Record<string, number> = {};\r
  order.forEach((n, i) => (pos[n] = i));\r
  return g.edges.every(([a, b]) => pos[a] < pos[b]);\r
}\r
`;export{e as default};