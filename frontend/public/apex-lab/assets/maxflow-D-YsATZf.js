var e=`// Max-flow / min-cut — how much can flow from a source to a sink through a capacitated network, and\r
// the bottleneck that limits it. Edmonds-Karp (Ford-Fulkerson with a BFS, so it always augments along\r
// a SHORTEST residual path) repeatedly finds an augmenting path and pushes its bottleneck capacity,\r
// updating residual capacities (including the reverse "cancelling" edges) until no path remains. The\r
// max-flow MIN-CUT theorem then falls out for free: the set S of nodes still reachable from the source\r
// in the final residual graph defines a cut, and the capacity of the edges crossing it EQUALS the max\r
// flow. Anchored to the canonical CLRS network (max flow = 23). Reference: CLRS ch.26; Edmonds-Karp 1972.\r
\r
export interface Edge { u: string; v: string; cap: number }\r
export interface AugStep { path: string[]; bottleneck: number; totalAfter: number; flows: Record<string, number> }\r
export interface MaxFlowResult { maxFlow: number; steps: AugStep[]; minCutS: string[]; cutEdges: Edge[]; flows: Record<string, number> }\r
\r
const ekey = (u: string, v: string) => \`\${u}->\${v}\`;\r
\r
export function maxflow(edges: Edge[], source: string, sink: string): MaxFlowResult {\r
  const nodes = new Set<string>();\r
  const res = new Map<string, Map<string, number>>();\r
  const ensure = (n: string) => { if (!res.has(n)) res.set(n, new Map()); nodes.add(n); };\r
  for (const e of edges) {\r
    ensure(e.u); ensure(e.v);\r
    res.get(e.u)!.set(e.v, (res.get(e.u)!.get(e.v) ?? 0) + e.cap);\r
    if (!res.get(e.v)!.has(e.u)) res.get(e.v)!.set(e.u, 0); // reverse residual edge starts at 0\r
  }\r
\r
  // BFS for a shortest augmenting path with positive residual capacity.\r
  const bfs = (): string[] | null => {\r
    const prev = new Map<string, string>();\r
    const seen = new Set([source]);\r
    const q = [source];\r
    while (q.length) {\r
      const u = q.shift()!;\r
      if (u === sink) break;\r
      for (const [v, c] of res.get(u) ?? []) {\r
        if (c > 0 && !seen.has(v)) { seen.add(v); prev.set(v, u); q.push(v); }\r
      }\r
    }\r
    if (!seen.has(sink)) return null;\r
    const path: string[] = [sink];\r
    let cur = sink;\r
    while (cur !== source) { cur = prev.get(cur)!; path.unshift(cur); }\r
    return path;\r
  };\r
\r
  const origCap = new Map<string, number>();\r
  for (const e of edges) origCap.set(ekey(e.u, e.v), (origCap.get(ekey(e.u, e.v)) ?? 0) + e.cap);\r
  const flowsNow = (): Record<string, number> => {\r
    const f: Record<string, number> = {};\r
    for (const e of edges) {\r
      const k = ekey(e.u, e.v);\r
      if (f[k] === undefined) f[k] = (origCap.get(k) ?? 0) - (res.get(e.u)!.get(e.v) ?? 0);\r
    }\r
    return f;\r
  };\r
\r
  const steps: AugStep[] = [];\r
  let total = 0;\r
  let path = bfs();\r
  while (path) {\r
    let bottleneck = Infinity;\r
    for (let i = 0; i + 1 < path.length; i++) bottleneck = Math.min(bottleneck, res.get(path[i])!.get(path[i + 1])!);\r
    for (let i = 0; i + 1 < path.length; i++) {\r
      const a = path[i], b = path[i + 1];\r
      res.get(a)!.set(b, res.get(a)!.get(b)! - bottleneck);\r
      res.get(b)!.set(a, (res.get(b)!.get(a) ?? 0) + bottleneck);\r
    }\r
    total += bottleneck;\r
    steps.push({ path, bottleneck, totalAfter: total, flows: flowsNow() });\r
    path = bfs();\r
  }\r
\r
  // min cut: nodes reachable from source in the final residual graph\r
  const S = new Set([source]);\r
  const stack = [source];\r
  while (stack.length) {\r
    const u = stack.pop()!;\r
    for (const [v, c] of res.get(u) ?? []) if (c > 0 && !S.has(v)) { S.add(v); stack.push(v); }\r
  }\r
  const cutEdges = edges.filter((e) => S.has(e.u) && !S.has(e.v));\r
  return { maxFlow: total, steps, minCutS: [...S].sort(), cutEdges, flows: flowsNow() };\r
}\r
`;export{e as default};