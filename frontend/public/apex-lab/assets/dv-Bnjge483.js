var e=`// Distance-vector routing (Bellman–Ford, as in RIP) — and its famous failure,\r
// count-to-infinity. Each router knows only its neighbours and the distance\r
// vectors they advertise; it picks D(x,y) = min over neighbours v of c(x,v) +\r
// D(v,y). It converges by gossip — but when a link dies, stale "I can still reach\r
// it" advertisements bounce between routers and the cost crawls upward one hop at a\r
// time. RIP caps the climb at 16 = unreachable; split-horizon/poison-reverse stops\r
// it outright. Pure, synchronous, deterministic model (tested).\r
\r
export const INF = 16; // RIP's "infinity"\r
export interface Edge { a: string; b: string; cost: number }\r
export interface Route { cost: number; via: string | null }\r
export type Tables = Record<string, Record<string, Route>>;\r
\r
export function neighborsOf(node: string, edges: Edge[]): { node: string; cost: number }[] {\r
  const out: { node: string; cost: number }[] = [];\r
  for (const e of edges) {\r
    if (e.a === node) out.push({ node: e.b, cost: e.cost });\r
    else if (e.b === node) out.push({ node: e.a, cost: e.cost });\r
  }\r
  return out;\r
}\r
\r
export function initTables(nodes: string[], edges: Edge[]): Tables {\r
  const t: Tables = {};\r
  for (const x of nodes) {\r
    t[x] = {};\r
    for (const y of nodes) t[x][y] = x === y ? { cost: 0, via: null } : { cost: INF, via: null };\r
    for (const nb of neighborsOf(x, edges)) t[x][nb.node] = { cost: nb.cost, via: nb.node };\r
  }\r
  return t;\r
}\r
\r
/** One synchronous round: every node recomputes from its neighbours' last tables. */\r
export function step(prev: Tables, nodes: string[], edges: Edge[], splitHorizon: boolean): Tables {\r
  const next: Tables = {};\r
  for (const x of nodes) {\r
    next[x] = {};\r
    const nbrs = neighborsOf(x, edges);\r
    for (const y of nodes) {\r
      if (x === y) { next[x][y] = { cost: 0, via: null }; continue; }\r
      let best = INF, via: string | null = null;\r
      for (const { node: v, cost: cxv } of nbrs) {\r
        let adv = prev[v][y].cost;\r
        if (splitHorizon && prev[v][y].via === x) adv = INF; // poison reverse: don't advertise a route back to its own next hop\r
        const c = Math.min(INF, cxv + adv);\r
        if (c < best) { best = c; via = v; }\r
      }\r
      next[x][y] = { cost: best, via };\r
    }\r
  }\r
  return next;\r
}\r
\r
const same = (a: Tables, b: Tables) => JSON.stringify(a) === JSON.stringify(b);\r
\r
/** Run rounds until the tables stop changing (or maxRounds), returning every snapshot. */\r
export function run(nodes: string[], edges: Edge[], splitHorizon: boolean, opts: { from?: Tables; maxRounds?: number } = {}): Tables[] {\r
  const max = opts.maxRounds ?? 40;\r
  const snaps: Tables[] = [opts.from ?? initTables(nodes, edges)];\r
  for (let i = 0; i < max; i++) {\r
    const next = step(snaps[snaps.length - 1], nodes, edges, splitHorizon);\r
    snaps.push(next);\r
    if (same(next, snaps[snaps.length - 2])) { snaps.pop(); break; } // converged; drop the duplicate\r
  }\r
  return snaps;\r
}\r
\r
/** Converge, cut a link, then watch it reconverge — the count-to-infinity scenario. */\r
export function brokenLinkTimeline(nodes: string[], edges: Edge[], broken: [string, string], splitHorizon: boolean) {\r
  const converged = run(nodes, edges, splitHorizon).pop()!;\r
  const remaining = edges.filter((e) => !((e.a === broken[0] && e.b === broken[1]) || (e.a === broken[1] && e.b === broken[0])));\r
  const timeline = run(nodes, remaining, splitHorizon, { from: converged });\r
  return { converged, timeline };\r
}\r
`;export{e as default};