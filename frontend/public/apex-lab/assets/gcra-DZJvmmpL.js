var e=`// GCRA — the Generic Cell Rate Algorithm, a rate limiter that needs just ONE number of state per client. It began\r
// life policing ATM network cells and is now the engine behind Redis's throttling (the redis-cell module) and\r
// many API gateways, because it does what a token bucket does with none of the bucket. A token bucket tracks a\r
// running count of tokens and refills it over time; GCRA instead tracks a single timestamp — the TAT, or\r
// "Theoretical Arrival Time," meaning "the earliest instant at which a perfectly-paced client should send its\r
// next request." Two parameters define the limit: the emission interval T = 1/rate (the ideal spacing between\r
// requests) and a tolerance τ (how far ahead of schedule a burst may run). A request arriving at time t is\r
// allowed exactly when t ≥ TAT − τ; if it is, the TAT jumps forward to max(t, TAT) + T. Fall behind schedule and\r
// the TAT stays put, so idle time silently "banks" burst capacity up to τ; run too fast and the TAT races past\r
// your clock until t < TAT − τ and you're throttled — and TAT − τ − t is precisely the Retry-After you should\r
// return. It is mathematically identical to a token bucket of capacity ⌊τ/T⌋+1 refilling one token every T, but\r
// carries no counter to increment on every tick: the passage of time IS the refill, encoded in the gap between\r
// now and the TAT. That O(1)-space, no-background-timer property is why it scales to millions of keys in a\r
// single Redis value. This models the TAT update, the allow/deny decision, and the retry-after. Reference:\r
// ITU-T I.371 (GCRA); the redis-cell / throttled implementations.\r
\r
export interface Decision { t: number; allow: boolean; tat: number; retryAfter: number }\r
\r
/** Requests allowed in an initial burst from an idle state: ⌊τ/T⌋ + 1. */\r
export const burstCapacity = (T: number, tau: number): number => Math.floor(tau / T) + 1;\r
\r
/** Run a stream of request arrival times through GCRA(T, τ). TAT starts at 0 (fully idle). */\r
export function simulate(times: number[], T: number, tau: number, tat0 = 0): Decision[] {\r
  let tat = tat0;\r
  const out: Decision[] = [];\r
  for (const t of times) {\r
    const allowAt = tat - tau;               // earliest time this request may arrive\r
    if (t < allowAt) {\r
      out.push({ t, allow: false, tat, retryAfter: allowAt - t }); // throttled; TAT unchanged\r
    } else {\r
      tat = Math.max(t, tat) + T;            // advance the schedule\r
      out.push({ t, allow: true, tat, retryAfter: 0 });\r
    }\r
  }\r
  return out;\r
}\r
\r
/** The sustained rate GCRA(T, τ) permits over the long run: one request per T. */\r
export const sustainedRatePerSec = (T: number): number => 1 / T;\r
`;export{e as default};