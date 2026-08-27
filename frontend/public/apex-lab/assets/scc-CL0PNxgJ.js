var e=`// Strongly connected components — the maximal groups of vertices where every node can reach every\r
// other, found by Kosaraju's beautifully simple two-pass DFS. Pass 1: DFS the graph, pushing each node\r
// onto a stack as it FINISHES. Pass 2: DFS the TRANSPOSE (all edges reversed), taking roots in reverse-\r
// finish order; each DFS tree is one SCC. Why it works: the reverse-finish order visits a "sink" SCC of\r
// the original first in the transpose, so a DFS there can't escape it. Collapsing each SCC to a point\r
// yields the CONDENSATION, which is always a DAG — the cycle structure of any digraph, made acyclic.\r
// Reference: CLRS ch.22.5; Kosaraju (unpublished) / Sharir 1981.\r
\r
export interface DiEdge { from: string; to: string }\r
export interface SccResult { components: string[][]; compOf: Record<string, number>; condensation: [number, number][] }\r
\r
const adjacency = (nodes: string[], edges: DiEdge[], reverse: boolean) => {\r
  const adj: Record<string, string[]> = Object.fromEntries(nodes.map((n) => [n, []]));\r
  for (const e of edges) (reverse ? adj[e.to].push(e.from) : adj[e.from].push(e.to));\r
  for (const n of nodes) adj[n].sort();\r
  return adj;\r
};\r
\r
export function nodesOf(edges: DiEdge[]): string[] {\r
  const s = new Set<string>();\r
  for (const e of edges) { s.add(e.from); s.add(e.to); }\r
  return [...s].sort();\r
}\r
\r
export function kosaraju(edges: DiEdge[], extraNodes: string[] = []): SccResult {\r
  const nodes = [...new Set([...nodesOf(edges), ...extraNodes])].sort();\r
  const adj = adjacency(nodes, edges, false);\r
  const radj = adjacency(nodes, edges, true);\r
\r
  // pass 1 — push nodes in order of DFS finish time\r
  const seen = new Set<string>();\r
  const order: string[] = [];\r
  const dfs1 = (u: string) => { seen.add(u); for (const v of adj[u]) if (!seen.has(v)) dfs1(v); order.push(u); };\r
  for (const n of nodes) if (!seen.has(n)) dfs1(n);\r
\r
  // pass 2 — DFS the transpose in reverse-finish order; each tree is one SCC\r
  const compOf: Record<string, number> = {};\r
  const components: string[][] = [];\r
  const assigned = new Set<string>();\r
  for (let i = order.length - 1; i >= 0; i--) {\r
    const root = order[i];\r
    if (assigned.has(root)) continue;\r
    const members: string[] = [];\r
    const stack = [root];\r
    assigned.add(root);\r
    while (stack.length) {\r
      const u = stack.pop()!;\r
      members.push(u);\r
      for (const v of radj[u]) if (!assigned.has(v)) { assigned.add(v); stack.push(v); }\r
    }\r
    members.sort();\r
    for (const m of members) compOf[m] = components.length;\r
    components.push(members);\r
  }\r
\r
  // condensation: one edge per distinct cross-component pair\r
  const seenEdge = new Set<string>();\r
  const condensation: [number, number][] = [];\r
  for (const e of edges) {\r
    const a = compOf[e.from], b = compOf[e.to];\r
    if (a !== b && !seenEdge.has(\`\${a}-\${b}\`)) { seenEdge.add(\`\${a}-\${b}\`); condensation.push([a, b]); }\r
  }\r
  return { components, compOf, condensation };\r
}\r
\r
/** True iff the condensation has no directed cycle (it always should — that's the theorem). */\r
export function isDag(result: SccResult): boolean {\r
  const n = result.components.length;\r
  const adj: number[][] = Array.from({ length: n }, () => []);\r
  for (const [a, b] of result.condensation) adj[a].push(b);\r
  const state = new Array(n).fill(0); // 0 unvisited, 1 in-stack, 2 done\r
  const dfs = (u: number): boolean => {\r
    state[u] = 1;\r
    for (const v of adj[u]) { if (state[v] === 1) return false; if (state[v] === 0 && !dfs(v)) return false; }\r
    state[u] = 2; return true;\r
  };\r
  for (let i = 0; i < n; i++) if (state[i] === 0 && !dfs(i)) return false;\r
  return true;\r
}\r
`;export{e as default};