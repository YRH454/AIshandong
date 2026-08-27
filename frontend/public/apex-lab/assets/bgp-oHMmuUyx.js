var e=`// BGP best-path selection — the decision ladder every router walks to pick ONE\r
// route when several reach the same prefix. It compares candidates rung by rung,\r
// stopping at the first attribute that breaks the tie. This is the canonical\r
// "why did BGP pick THAT path?" — modeled here as pure, tested logic (the order\r
// matches Cisco/standard BGP best-path; RFC 4271 §9.1 plus common vendor steps).\r
\r
export type Origin = 'IGP' | 'EGP' | 'INCOMPLETE'; // best → worst (i < e < ?)\r
const ORIGIN_RANK: Record<Origin, number> = { IGP: 0, EGP: 1, INCOMPLETE: 2 };\r
\r
export interface Route {\r
  id: string; // a short label, e.g. "via AS65010"\r
  nextHop: string;\r
  weight: number; // Cisco-local, higher wins (never advertised)\r
  localPref: number; // higher wins (within the AS)\r
  asPath: number[]; // shorter wins\r
  origin: Origin; // IGP < EGP < INCOMPLETE\r
  med: number; // lower wins (only compared among same-neighbor-AS by default; simplified here)\r
  fromEbgp: boolean; // eBGP preferred over iBGP\r
  igpMetric: number; // lower wins (metric to the next hop)\r
  routerId: number; // lowest wins (final tie-break)\r
}\r
\r
export interface Rung {\r
  key: string; // attribute name\r
  label: string; // human label\r
  better: 'higher' | 'lower'; // which direction wins\r
  value: (r: Route) => number; // numeric comparison value (already normalized so LOWER number = better)\r
  explain: string;\r
}\r
\r
// Each rung returns a number where LOWER = better, so one comparator handles all.\r
export const LADDER: Rung[] = [\r
  { key: 'weight', label: 'Weight', better: 'higher', value: (r) => -r.weight, explain: 'Cisco-proprietary, local to this router and never advertised. Highest wins.' },\r
  { key: 'localPref', label: 'Local Preference', better: 'higher', value: (r) => -r.localPref, explain: 'Set within your AS to steer outbound traffic. Highest wins, and it propagates across iBGP.' },\r
  { key: 'asPath', label: 'AS_PATH length', better: 'lower', value: (r) => r.asPath.length, explain: 'Fewer autonomous systems to cross. Shortest wins — the attribute people think of as “BGP distance”.' },\r
  { key: 'origin', label: 'Origin code', better: 'lower', value: (r) => ORIGIN_RANK[r.origin], explain: 'How the route entered BGP: IGP (i) beats EGP (e) beats INCOMPLETE (?).' },\r
  { key: 'med', label: 'MED', better: 'lower', value: (r) => r.med, explain: 'Multi-Exit Discriminator — a hint from a neighbor AS about which of its entry points to prefer. Lowest wins.' },\r
  { key: 'ebgp', label: 'eBGP over iBGP', better: 'lower', value: (r) => (r.fromEbgp ? 0 : 1), explain: 'A route learned from an external peer is preferred over one learned internally.' },\r
  { key: 'igpMetric', label: 'IGP metric to next hop', better: 'lower', value: (r) => r.igpMetric, explain: 'Cost to actually reach the BGP next hop, per the IGP (OSPF/IS-IS). Lowest wins.' },\r
  { key: 'routerId', label: 'Lowest router-ID', better: 'lower', value: (r) => r.routerId, explain: 'The deterministic final tie-break: prefer the path from the peer with the lowest BGP router-ID.' },\r
];\r
\r
export interface DecisionStep {\r
  rung: Rung;\r
  bestValue: number; // the winning (lowest) value at this rung among survivors\r
  survivors: string[]; // route ids still in contention AFTER this rung\r
  eliminated: string[]; // route ids knocked out AT this rung\r
  decisive: boolean; // did this rung reduce the field to one / break the tie?\r
}\r
\r
export interface BgpDecision {\r
  steps: DecisionStep[];\r
  winner: Route | null;\r
  decidedAt: string | null; // the rung key that produced the single winner\r
}\r
\r
/** Walk the ladder over candidate routes, recording who is eliminated at each rung. */\r
export function selectBestPath(routes: Route[]): BgpDecision {\r
  const steps: DecisionStep[] = [];\r
  let survivors = routes.slice();\r
  let decidedAt: string | null = null;\r
\r
  for (const rung of LADDER) {\r
    if (survivors.length <= 1) break;\r
    const before = survivors;\r
    let best = Infinity;\r
    for (const r of before) best = Math.min(best, rung.value(r));\r
    const survived = before.filter((r) => rung.value(r) === best);\r
    const eliminated = before.filter((r) => rung.value(r) !== best);\r
    const decisive = survived.length < before.length;\r
    steps.push({\r
      rung, bestValue: best,\r
      survivors: survived.map((r) => r.id),\r
      eliminated: eliminated.map((r) => r.id),\r
      decisive,\r
    });\r
    survivors = survived;\r
    if (survivors.length === 1 && decidedAt === null) decidedAt = rung.key;\r
  }\r
\r
  return { steps, winner: survivors.length >= 1 ? survivors[0] : null, decidedAt };\r
}\r
`;export{e as default};