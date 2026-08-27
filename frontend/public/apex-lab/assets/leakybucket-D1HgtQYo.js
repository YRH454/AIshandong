var e=`// Leaky bucket — traffic shaping that turns a bursty arrival stream into a perfectly smooth output.\r
// Picture a bucket with a hole: packets pour in (and spill over if it's already full), but they only\r
// drain out at a fixed rate, no matter how they arrived. The output is therefore constant — the bucket\r
// absorbs bursts up to its capacity and DROPS whatever overflows. This is the opposite trade-off from\r
// the token bucket (the existing rate-limit section): a token bucket SAVES up allowance so it can let a\r
// later burst through, whereas a leaky bucket never bursts — it enforces a hard, even rate. Shapers in\r
// routers and QoS schedulers use it to police a flow to its contracted rate. Reference: Turner 1986\r
// ("New directions in communications"); Tanenbaum, Computer Networks (traffic shaping).\r
\r
export interface Tick { t: number; arrived: number; admitted: number; dropped: number; output: number; level: number }\r
\r
/** Simulate the bucket over \`arrivals\` (packets arriving each tick): admit up to remaining capacity\r
 *  (dropping overflow), then leak at a constant \`leakRate\`. Output is the leak — smooth by construction. */\r
export function leakyBucket(arrivals: number[], capacity: number, leakRate: number): Tick[] {\r
  const out: Tick[] = [];\r
  let level = 0;\r
  for (let t = 0; t < arrivals.length; t++) {\r
    const a = arrivals[t];\r
    const space = capacity - level;\r
    const admitted = Math.max(0, Math.min(a, space));\r
    const dropped = a - admitted;\r
    level += admitted;\r
    const output = Math.min(level, leakRate); // constant drain, capped by what's in the bucket\r
    level -= output;\r
    out.push({ t, arrived: a, admitted, dropped, output, level });\r
  }\r
  return out;\r
}\r
\r
export const totalDropped = (ticks: Tick[]) => ticks.reduce((a, t) => a + t.dropped, 0);\r
export const totalOutput = (ticks: Tick[]) => ticks.reduce((a, t) => a + t.output, 0);\r
/** The largest single-tick output — for a leaky bucket this never exceeds the leak rate (it can't burst). */\r
export const peakOutput = (ticks: Tick[]) => ticks.reduce((m, t) => Math.max(m, t.output), 0);\r
`;export{e as default};