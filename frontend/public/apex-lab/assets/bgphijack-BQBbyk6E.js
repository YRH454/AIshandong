var e=`// BGP route propagation & hijacking — how a route to a prefix spreads across the\r
// internet's autonomous systems, and how an attacker steals traffic by lying. An AS\r
// announces a prefix; neighbors learn a route whose AS_PATH is the announcer's path\r
// with the announcer prepended; each AS keeps the SHORTEST loop-free AS_PATH and\r
// re-advertises its best. A HIJACK is just another AS announcing the same prefix: any\r
// AS for whom the rogue's path is shorter switches to it, sending that traffic to the\r
// attacker. A MORE-SPECIFIC announcement (a longer prefix) beats everything via\r
// longest-prefix match, capturing the whole internet. Real BGP path selection. Tested.\r
\r
export interface AsGraph { nodes: number[]; edges: [number, number][] }\r
\r
export interface Route {\r
  origin: number; // the AS that originated the prefix (real or rogue)\r
  asPath: number[]; // ordered AS_PATH from this AS to the origin (this AS first)\r
}\r
\r
export interface PropResult {\r
  best: Record<number, Route>; // each AS's chosen route to the prefix\r
}\r
\r
function neighbours(g: AsGraph, n: number): number[] {\r
  const out: number[] = [];\r
  for (const [a, b] of g.edges) { if (a === n) out.push(b); if (b === n) out.push(a); }\r
  return out;\r
}\r
\r
// shorter AS_PATH wins; among equal lengths, break the tie on the FULL AS_PATH compared\r
// element-by-element (next hop, then the hop after, …). This is a TOTAL order — no two distinct\r
// routes ever tie — so Bellman-Ford converges to the same unique best regardless of the order in\r
// which nodes/edges are relaxed. (A partial tie-break on next-hop alone left equal-next-hop routes\r
// undecided, pinning whichever was recorded first → results depended on iteration order.)\r
function better(a: Route, b: Route): boolean {\r
  if (a.asPath.length !== b.asPath.length) return a.asPath.length < b.asPath.length;\r
  for (let i = 1; i < a.asPath.length; i++) { // index 0 is this AS itself (equal for both candidates)\r
    if (a.asPath[i] !== b.asPath[i]) return a.asPath[i] < b.asPath[i];\r
  }\r
  return false; // identical paths — genuinely equal\r
}\r
\r
/**\r
 * Propagate one or more origins of the SAME prefix across the graph. Each origin AS\r
 * starts with AS_PATH [itself]; routes flood outward, prepending and dropping loops,\r
 * keeping the best per AS. Returns each AS's chosen route (and thus which origin it\r
 * sends traffic toward).\r
 */\r
export function propagate(g: AsGraph, origins: number[]): PropResult {\r
  const best: Record<number, Route> = {};\r
  for (const o of origins) best[o] = { origin: o, asPath: [o] };\r
\r
  // relax until stable (Bellman-Ford style over AS_PATH length)\r
  let changed = true;\r
  while (changed) {\r
    changed = false;\r
    for (const n of g.nodes) {\r
      for (const nb of neighbours(g, n)) {\r
        const adv = best[nb];\r
        if (!adv) continue;\r
        if (adv.asPath.includes(n)) continue; // loop prevention\r
        const candidate: Route = { origin: adv.origin, asPath: [n, ...adv.asPath] };\r
        if (!best[n] || better(candidate, best[n])) { best[n] = candidate; changed = true; }\r
      }\r
    }\r
  }\r
  return { best };\r
}\r
\r
/** Which AS does \`as\` ultimately route to — the real origin or the hijacker? */\r
export function routesTo(res: PropResult, as: number): number | null {\r
  return res.best[as]?.origin ?? null;\r
}\r
\r
export interface HijackResult {\r
  prop: PropResult;\r
  captured: number[]; // ASes now routing to the hijacker\r
  legit: number[]; // ASes still routing to the real origin\r
}\r
\r
/**\r
 * Compute the hijack outcome. With \`moreSpecific\`, the rogue announces a longer\r
 * prefix that wins everywhere via longest-prefix match (every reachable AS captured).\r
 */\r
export function hijack(g: AsGraph, realOrigin: number, rogue: number, moreSpecific: boolean): HijackResult {\r
  if (moreSpecific) {\r
    const prop = propagate(g, [rogue]); // a more-specific route is preferred by all\r
    const captured = g.nodes.filter((n) => routesTo(prop, n) === rogue);\r
    return { prop, captured, legit: g.nodes.filter((n) => !captured.includes(n)) };\r
  }\r
  const prop = propagate(g, [realOrigin, rogue]);\r
  const captured = g.nodes.filter((n) => routesTo(prop, n) === rogue && n !== realOrigin);\r
  const legit = g.nodes.filter((n) => routesTo(prop, n) === realOrigin);\r
  return { prop, captured, legit };\r
}\r
`;export{e as default};