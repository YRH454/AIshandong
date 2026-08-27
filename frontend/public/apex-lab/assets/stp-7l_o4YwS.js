var e=`// Spanning Tree Protocol (IEEE 802.1D) — turn a looped switch topology into a\r
// loop-free tree so broadcasts don't circulate forever. Bridges elect a ROOT (lowest\r
// bridge ID), each non-root bridge finds its shortest path to the root and marks that\r
// link its ROOT PORT, each segment picks a DESIGNATED port (the end closer to the\r
// root), and every remaining port is BLOCKED — cutting exactly the redundant links\r
// that would form loops. Pure shortest-path + tie-break model (tested).\r
\r
export interface Link { a: number; b: number; cost: number }\r
export type Role = 'root-port' | 'designated' | 'blocked';\r
\r
const INF = Infinity;\r
\r
/** Dijkstra distances from \`root\` over the undirected weighted links. */\r
function distances(bridges: number[], links: Link[], root: number): Record<number, number> {\r
  const dist: Record<number, number> = {};\r
  for (const b of bridges) dist[b] = b === root ? 0 : INF;\r
  const seen = new Set<number>();\r
  while (seen.size < bridges.length) {\r
    let u = -1, best = INF;\r
    for (const b of bridges) if (!seen.has(b) && dist[b] < best) { best = dist[b]; u = b; }\r
    if (u === -1) break;\r
    seen.add(u);\r
    for (const l of links) {\r
      const v = l.a === u ? l.b : l.b === u ? l.a : null;\r
      if (v !== null && dist[u] + l.cost < dist[v]) dist[v] = dist[u] + l.cost;\r
    }\r
  }\r
  return dist;\r
}\r
\r
export interface PortRole { link: Link; bridge: number; other: number; role: Role }\r
\r
export interface StpResult { root: number; dist: Record<number, number>; ports: PortRole[]; blocked: number }\r
\r
export function spanningTree(bridges: number[], links: Link[]): StpResult {\r
  const root = Math.min(...bridges); // lowest bridge ID wins\r
  const dist = distances(bridges, links, root);\r
\r
  // each non-root bridge's root port = the link giving its shortest path (tiebreak:\r
  // lower neighbour ID, then lower cost)\r
  const rootPort: Record<number, Link | null> = {};\r
  for (const b of bridges) {\r
    if (b === root) { rootPort[b] = null; continue; }\r
    let best: Link | null = null, bestCost = INF, bestNb = INF;\r
    for (const l of links) {\r
      const nb = l.a === b ? l.b : l.b === b ? l.a : null;\r
      if (nb === null) continue;\r
      const c = dist[nb] + l.cost;\r
      if (c < bestCost || (c === bestCost && nb < bestNb)) { best = l; bestCost = c; bestNb = nb; }\r
    }\r
    rootPort[b] = best;\r
  }\r
\r
  const ports: PortRole[] = [];\r
  for (const l of links) {\r
    // designated end of the segment = the bridge closer to root (tiebreak lower ID)\r
    const desig = dist[l.a] < dist[l.b] || (dist[l.a] === dist[l.b] && l.a < l.b) ? l.a : l.b;\r
    for (const [bridge, other] of [[l.a, l.b], [l.b, l.a]] as const) {\r
      let role: Role;\r
      if (bridge === desig) role = 'designated';\r
      else if (rootPort[bridge] === l) role = 'root-port';\r
      else role = 'blocked';\r
      ports.push({ link: l, bridge, other, role });\r
    }\r
  }\r
  return { root, dist, ports, blocked: ports.filter((p) => p.role === 'blocked').length };\r
}\r
`;export{e as default};