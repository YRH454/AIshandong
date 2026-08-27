var e=`// BGP route flap damping — how the internet's routers protect themselves from an unstable link that keeps\r
// "flapping" (a route repeatedly withdrawn and re-announced, e.g. a marginal fiber or a rebooting router). Every\r
// flap forces every BGP speaker that hears it to recompute best paths and propagate the change onward; a single\r
// flapping prefix, unchecked, can burn CPU across thousands of routers worldwide. Damping fixes this with a\r
// simple per-route reputation score. Each route carries a PENALTY that starts at 0. Every flap adds a fixed\r
// amount (classically 1000). The penalty DECAYS exponentially over time (a half-life of ~15 minutes), so a\r
// route that behaves is quickly forgiven. Two thresholds with HYSTERESIS control use: when the penalty climbs\r
// above the SUPPRESS threshold (2000) the route is suppressed — the router stops using and re-advertising it,\r
// even if it's currently up — and it stays suppressed until the penalty decays back below the lower REUSE\r
// threshold (750). The gap between the two thresholds is deliberate: it stops a route from oscillating in and\r
// out of service right at the boundary. A well-behaved link that blips once is barely penalized and never\r
// suppressed; a chronically flapping one accumulates penalty faster than it decays, gets suppressed, and is\r
// only restored once it's been stable for a good while. This models the penalty, its decay, and the\r
// suppress/reuse state machine. Reference: RFC 2439 (BGP Route Flap Damping).\r
\r
export interface Config { penaltyPerFlap: number; suppress: number; reuse: number; halfLifeSec: number }\r
export const DEFAULTS: Config = { penaltyPerFlap: 1000, suppress: 2000, reuse: 750, halfLifeSec: 900 };\r
\r
export interface Point { t: number; penalty: number; suppressed: boolean; flap: boolean }\r
\r
/** Simulate a route over \`durationSec\` (step \`dtSec\`), applying flaps at the given times. */\r
export function simulate(flapTimes: number[], durationSec: number, dtSec: number, cfg: Config = DEFAULTS): { series: Point[]; suppressedFor: number } {\r
  const decay = Math.pow(0.5, dtSec / cfg.halfLifeSec);   // multiply per step for exponential half-life\r
  const flapSet = new Set(flapTimes.map((t) => Math.round(t / dtSec) * dtSec));\r
  let penalty = 0, suppressed = false, suppressedFor = 0;\r
  const series: Point[] = [];\r
  for (let t = 0; t <= durationSec; t += dtSec) {\r
    penalty *= decay;                                     // decay first\r
    const flap = flapSet.has(t);\r
    if (flap) penalty += cfg.penaltyPerFlap;\r
    if (!suppressed && penalty > cfg.suppress) suppressed = true;   // cross up → suppress\r
    else if (suppressed && penalty < cfg.reuse) suppressed = false; // decay below reuse → restore\r
    if (suppressed) suppressedFor += dtSec;\r
    series.push({ t, penalty, suppressed, flap });\r
  }\r
  return { series, suppressedFor };\r
}\r
\r
/** Evenly spaced flap times over [0, until), one every \`intervalSec\`. */\r
export const flapEvery = (intervalSec: number, until: number): number[] =>\r
  Array.from({ length: Math.floor(until / intervalSec) }, (_, i) => (i + 1) * intervalSec);\r
`;export{e as default};