var e=`// Link-state routing (OSPF) — the paradigm opposite to distance-vector. Instead of telling neighbors\r
// its ROUTES, every router floods a Link-State Advertisement describing only its own directly-attached\r
// links. Flooding is reliable and hop-by-hop, so after a few rounds EVERY router holds the identical\r
// link-state database (LSDB) — the complete map of the network. Each router then independently runs\r
// Dijkstra (the SPF, shortest-path-first, computation) over that map to build its routing table. No\r
// router ever trusts another's path math, which is why link-state converges without the count-to-\r
// infinity of distance-vector. Reference: RFC 2328 (OSPFv2) §12-13 (LSAs/flooding) and §16 (SPF).\r
\r
export interface Link { a: string; b: string; cost: number } // undirected\r
export type Topology = Link[];\r
\r
export function routers(topo: Topology): string[] {\r
  const set = new Set<string>();\r
  for (const l of topo) { set.add(l.a); set.add(l.b); }\r
  return [...set].sort();\r
}\r
\r
/** Each router's directly-attached links — this is the content of the LSA it originates. */\r
export function neighbors(topo: Topology, node: string): { node: string; cost: number }[] {\r
  const out: { node: string; cost: number }[] = [];\r
  for (const l of topo) {\r
    if (l.a === node) out.push({ node: l.b, cost: l.cost });\r
    else if (l.b === node) out.push({ node: l.a, cost: l.cost });\r
  }\r
  return out.sort((x, y) => (x.node < y.node ? -1 : 1));\r
}\r
\r
export interface FloodResult { rounds: number; converged: boolean; have: Record<string, string[]> }\r
\r
/** Simulate reliable flooding: each router starts knowing only its OWN LSA, and each round adopts any\r
 *  LSA a neighbour already holds. Returns the number of rounds until every LSDB is the full topology. */\r
export function flood(topo: Topology): FloodResult {\r
  const all = routers(topo);\r
  const have: Record<string, Set<string>> = {};\r
  for (const r of all) have[r] = new Set([r]); // a router originates (knows) its own LSA\r
\r
  let rounds = 0;\r
  for (let guard = 0; guard < all.length + 2; guard++) {\r
    let changed = false;\r
    const snapshot: Record<string, Set<string>> = {};\r
    for (const r of all) snapshot[r] = new Set(have[r]);\r
    for (const r of all) {\r
      for (const nb of neighbors(topo, r)) {\r
        for (const lsa of snapshot[nb.node]) {\r
          if (!have[r].has(lsa)) { have[r].add(lsa); changed = true; }\r
        }\r
      }\r
    }\r
    if (!changed) break;\r
    rounds++;\r
  }\r
  const have2: Record<string, string[]> = {};\r
  for (const r of all) have2[r] = [...have[r]].sort();\r
  const converged = all.every((r) => have[r].size === all.length);\r
  return { rounds, converged, have: have2 };\r
}\r
\r
export interface Route { dest: string; cost: number; nextHop: string | null; path: string[] }\r
\r
/** Dijkstra's SPF over the full LSDB from \`source\`, yielding cost, first-hop and full path per router. */\r
export function spf(topo: Topology, source: string): Record<string, Route> {\r
  const all = routers(topo);\r
  const dist: Record<string, number> = {};\r
  const prev: Record<string, string | null> = {};\r
  for (const r of all) { dist[r] = Infinity; prev[r] = null; }\r
  dist[source] = 0;\r
  const unvisited = new Set(all);\r
\r
  while (unvisited.size) {\r
    // pick the unvisited node of least tentative distance (ties: lexicographic, for determinism)\r
    let u: string | null = null;\r
    for (const r of unvisited) if (u === null || dist[r] < dist[u] || (dist[r] === dist[u] && r < u)) u = r;\r
    if (u === null || dist[u] === Infinity) break;\r
    unvisited.delete(u);\r
    for (const nb of neighbors(topo, u)) {\r
      const alt = dist[u] + nb.cost;\r
      if (alt < dist[nb.node] || (alt === dist[nb.node] && u < (prev[nb.node] ?? '￿'))) {\r
        dist[nb.node] = alt; prev[nb.node] = u;\r
      }\r
    }\r
  }\r
\r
  const routes: Record<string, Route> = {};\r
  for (const dest of all) {\r
    if (dest === source) { routes[dest] = { dest, cost: 0, nextHop: null, path: [source] }; continue; }\r
    const path: string[] = [];\r
    let cur: string | null = dest;\r
    while (cur !== null) { path.unshift(cur); cur = prev[cur]; }\r
    const nextHop = path.length >= 2 && path[0] === source ? path[1] : null;\r
    routes[dest] = { dest, cost: dist[dest], nextHop, path: path[0] === source ? path : [] };\r
  }\r
  return routes;\r
}\r
`;export{e as default};