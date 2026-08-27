var e=`// SLOs & error budgets — the math that turns "be reliable" into a number you can spend. An SLO is a\r
// target like "99.9% of requests succeed over 30 days." Its complement is the ERROR BUDGET: 0.1% of\r
// requests are *allowed* to fail. That budget is permission to take risk — ship features, run\r
// experiments, do maintenance — right up until it runs out, at which point the policy flips to "freeze\r
// releases, fix reliability." The BURN RATE says how fast you're spending it: an error rate of 1% against\r
// a 0.1% budget burns at 10× (you'd exhaust a month's budget in ~3 days). Fast-burn alerts (e.g. 14.4×\r
// over 1h) page you on an acute outage; slow-burn alerts catch a steady leak. This reframes reliability\r
// from "never fail" (impossible, and you'd never ship) to "fail within budget." Reference: Google SRE\r
// Workbook, "Implementing SLOs"; the multiwindow multi-burn-rate alerting chapter.\r
\r
export interface Budget { total: number; allowed: number; consumed: number; remaining: number; remainingPct: number; exhausted: boolean }\r
\r
/** Error budget over a window of \`totalRequests\` for a given SLO (e.g. 0.999), after \`failures\` so far. */\r
export function budget(slo: number, totalRequests: number, failures: number): Budget {\r
  const allowed = Math.round((1 - slo) * totalRequests * 1e6) / 1e6; // round off float noise ((1-.999)*1e6 ≈ 999.9999…)\r
  const remaining = allowed - failures;\r
  return {\r
    total: totalRequests, allowed, consumed: failures,\r
    remaining, remainingPct: allowed === 0 ? 0 : Math.max(0, (remaining / allowed) * 100),\r
    exhausted: failures >= allowed,\r
  };\r
}\r
\r
/** Burn rate = how many times faster than "sustainable" you're spending budget. 1× exactly uses the\r
 *  whole budget over the window; >1× exhausts it early. burnRate = actualErrorRate / (1 − slo). */\r
export const burnRate = (actualErrorRate: number, slo: number) => actualErrorRate / (1 - slo);\r
\r
/** Time to exhaust the remaining budget at the current burn rate, as a fraction of the SLO window. */\r
export function timeToExhaust(b: Budget, rate: number, windowMinutes: number): number {\r
  if (rate <= 0 || b.remaining <= 0) return rate <= 0 ? Infinity : 0;\r
  // remaining budget / (budget-spend-per-minute). spend per minute at rate r = (allowed/window)·r\r
  const perMin = (b.allowed / windowMinutes) * rate;\r
  return b.remaining / perMin;\r
}\r
\r
/** A standard multiwindow burn-rate alert fires when the rate exceeds the threshold for that window. */\r
export interface BurnAlert { label: string; window: string; threshold: number; firing: boolean; severity: 'page' | 'ticket' }\r
export function burnAlerts(rate: number): BurnAlert[] {\r
  return [\r
    { label: 'fast burn', window: '1h', threshold: 14.4, severity: 'page', firing: rate >= 14.4 },\r
    { label: 'medium burn', window: '6h', threshold: 6, severity: 'page', firing: rate >= 6 },\r
    { label: 'slow burn', window: '3d', threshold: 1, severity: 'ticket', firing: rate >= 1 },\r
  ];\r
}\r
\r
/** SLO policy: spend the budget on features while it lasts; freeze releases once it's gone. */\r
export const releasePolicy = (b: Budget) => (b.exhausted ? 'FREEZE releases — focus on reliability until the budget recovers' : 'budget available — ship features, take risks');\r
`;export{e as default};