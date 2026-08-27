var e=`// Segment Routing (SR / SPRING) — modern source routing that steers a packet along a chosen path by writing a\r
// small STACK of waypoints ("segments") into its header, instead of asking every router in the middle to hold\r
// per-flow state (the way old RSVP-TE/MPLS traffic engineering did). Each segment is an instruction. The two\r
// basic kinds: a NODE segment ("get to router X" — every router forwards it along the shortest path toward X,\r
// so it's a globally-known label), and an ADJACENCY segment ("from here, take this specific link" — a local\r
// label that forces one hop, even a non-shortest one). The source picks a path, encodes it as an ordered\r
// segment list, and pushes it onto the packet; each router looks at the top segment, forwards toward it, and\r
// pops it once reached. The realized route is just the concatenation of the shortest paths between consecutive\r
// segments (with adjacency segments forcing exact links). The payoff: arbitrary traffic engineering — send this\r
// flow the scenic way to dodge a congested link — with state only at the edge, nothing to sign up the core for.\r
// This models the topology, shortest paths, and segment-list expansion. Reference: RFC 8402 (SR architecture);\r
// RFC 8660 (SR-MPLS).\r
\r
export type Graph = Record<string, Record<string, number>>; // undirected weighted adjacency\r
export type Segment = { type: 'node'; node: string } | { type: 'adj'; from: string; to: string };\r
\r
/** Dijkstra shortest paths from \`src\`. */\r
export function dijkstra(g: Graph, src: string): { dist: Record<string, number>; prev: Record<string, string> } {\r
  const dist: Record<string, number> = {}, prev: Record<string, string> = {}, done = new Set<string>();\r
  for (const n in g) dist[n] = Infinity;\r
  dist[src] = 0;\r
  for (;;) {\r
    let u: string | null = null, best = Infinity;\r
    for (const n in g) if (!done.has(n) && dist[n] < best) { best = dist[n]; u = n; }\r
    if (u === null) break;\r
    done.add(u);\r
    for (const v in g[u]) { const nd = dist[u] + g[u][v]; if (nd < dist[v]) { dist[v] = nd; prev[v] = u; } }\r
  }\r
  return { dist, prev };\r
}\r
\r
/** The shortest-path node sequence from src to dst (empty if unreachable). */\r
export function shortestPath(g: Graph, src: string, dst: string): string[] {\r
  if (src === dst) return [src];\r
  const { dist, prev } = dijkstra(g, src);\r
  if (dist[dst] === Infinity) return [];\r
  const path: string[] = []; let n: string | undefined = dst;\r
  while (n !== undefined) { path.unshift(n); if (n === src) break; n = prev[n]; }\r
  return path[0] === src ? path : [];\r
}\r
\r
export interface SrResult { hops: string[]; cost: number; valid: boolean }\r
\r
/** Expand a segment list starting at \`start\` into the realized hop-by-hop path. */\r
export function srPath(g: Graph, start: string, segments: Segment[]): SrResult {\r
  let current = start; const hops = [start]; let cost = 0;\r
  const walk = (path: string[]): boolean => {\r
    if (!path.length || path[0] !== current) return false;\r
    for (let i = 1; i < path.length; i++) { cost += g[path[i - 1]][path[i]]; hops.push(path[i]); }\r
    current = path[path.length - 1];\r
    return true;\r
  };\r
  for (const seg of segments) {\r
    if (seg.type === 'node') {\r
      if (!walk(shortestPath(g, current, seg.node))) return { hops, cost, valid: false };\r
    } else {\r
      if (current !== seg.from && !walk(shortestPath(g, current, seg.from))) return { hops, cost, valid: false };\r
      if (g[current]?.[seg.to] === undefined) return { hops, cost, valid: false }; // not a real link\r
      cost += g[current][seg.to]; hops.push(seg.to); current = seg.to;\r
    }\r
  }\r
  return { hops, cost, valid: true };\r
}\r
\r
/** Total weight of a node sequence, or Infinity if any hop isn't an edge. */\r
export function pathCost(g: Graph, path: string[]): number {\r
  let c = 0;\r
  for (let i = 1; i < path.length; i++) { const w = g[path[i - 1]]?.[path[i]]; if (w === undefined) return Infinity; c += w; }\r
  return c;\r
}\r
`;export{e as default};