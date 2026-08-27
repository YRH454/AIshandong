var e=`// Retry resilience — backoff, jitter, and the circuit breaker. When an upstream fails, a naive\r
// client retries immediately, and a whole FLEET retrying in lockstep becomes a thundering herd that\r
// keeps the upstream down. Two mechanisms fix this. (1) BACKOFF + JITTER: wait exponentially longer\r
// between tries, and randomize the wait so the fleet de-synchronizes — AWS's "full jitter" picks a\r
// delay uniformly in [0, base·2^attempt]. (2) CIRCUIT BREAKER: stop hammering a known-dead upstream\r
// at all — after N consecutive failures the breaker trips OPEN and fails fast, sheds load while the\r
// upstream heals, then after a cooldown goes HALF-OPEN to probe with a single trial before closing.\r
// Both models are deterministic (seeded), so the visualization is exactly reproducible. Tested.\r
\r
// ---- backoff & jitter ---------------------------------------------------------------------------\r
\r
export type Strategy = 'none' | 'fixed' | 'exp' | 'jitter';\r
\r
/** A tiny deterministic LCG (so jitter is reproducible and testable). */\r
export function lcg(seed: number): () => number {\r
  let s = (seed >>> 0) || 1;\r
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };\r
}\r
\r
/** The delay before retry #\`attempt\`. Exp = base·2^attempt capped; jitter = uniform [0, that]. */\r
export function backoffDelay(strategy: Strategy, attempt: number, baseMs: number, capMs: number, rnd: () => number): number {\r
  const exp = Math.min(capMs, baseMs * 2 ** attempt);\r
  if (strategy === 'none') return 0;\r
  if (strategy === 'fixed') return baseMs;\r
  if (strategy === 'exp') return exp;\r
  return Math.floor(rnd() * (exp + 1)); // AWS "full jitter": uniform in [0, exp]\r
}\r
\r
export interface FleetResult {\r
  strategy: Strategy;\r
  buckets: number[]; // retry attempts per time bucket across the whole fleet\r
  bucketMs: number;\r
  peak: number; // busiest bucket overall\r
  retryPeak: number; // busiest bucket counting only RETRIES (attempt ≥ 1) — the retry-wave height\r
  total: number; // total attempts the upstream had to field\r
}\r
\r
export interface FleetOpts {\r
  clients: number; baseMs: number; capMs: number; healMs: number;\r
  maxAttempts: number; horizonMs: number; bucketMs: number; seed: number;\r
}\r
\r
/** Simulate a fleet that all fails at t=0 and retries under \`strategy\`, until the upstream heals. */\r
export function simulateFleet(strategy: Strategy, o: FleetOpts): FleetResult {\r
  const nb = Math.floor(o.horizonMs / o.bucketMs) + 1;\r
  const buckets = new Array(nb).fill(0);\r
  const retryBuckets = new Array(nb).fill(0); // counts ONLY retries (attempt ≥ 1), wherever they land\r
  let total = 0;\r
  for (let c = 0; c < o.clients; c++) {\r
    const rnd = lcg(o.seed + c * 7919);\r
    let t = 0, a = 0;\r
    while (a < o.maxAttempts && t <= o.horizonMs) {\r
      const b = Math.floor(t / o.bucketMs);\r
      if (b < nb) { buckets[b]++; if (a >= 1) retryBuckets[b]++; }\r
      total++;\r
      if (t >= o.healMs) break; // upstream healed → this attempt succeeds, client stops\r
      t += backoffDelay(strategy, a, o.baseMs, o.capMs, rnd);\r
      a++;\r
    }\r
  }\r
  // retryPeak counts retries honestly (a jittered first retry can fall in bucket 0 — it's still counted)\r
  return { strategy, buckets, bucketMs: o.bucketMs, peak: Math.max(...buckets), retryPeak: Math.max(0, ...retryBuckets), total };\r
}\r
\r
// ---- circuit breaker (Nygard / Hystrix three-state machine) -------------------------------------\r
\r
export type BreakerState = 'closed' | 'open' | 'half-open';\r
export interface BreakerCfg { failThreshold: number; cooldownMs: number }\r
export interface Req { t: number; upstream: 'success' | 'failure' } // what the upstream WOULD return if asked\r
export interface BreakerStep { t: number; state: BreakerState; allowed: boolean; result: 'success' | 'failure' | 'shed'; nextState: BreakerState }\r
\r
/** Drive the breaker over a request trace. CLOSED counts failures→OPEN; OPEN fails fast until the\r
 *  cooldown elapses→HALF-OPEN; HALF-OPEN's single trial closes on success or re-opens on failure. */\r
export function runBreaker(reqs: Req[], cfg: BreakerCfg): BreakerStep[] {\r
  let state: BreakerState = 'closed';\r
  let fails = 0;\r
  let openedAt = 0;\r
  const steps: BreakerStep[] = [];\r
  for (const req of reqs) {\r
    if (state === 'open' && req.t - openedAt >= cfg.cooldownMs) state = 'half-open'; // cooldown elapsed → probe\r
    const before = state;\r
    let allowed: boolean, result: BreakerStep['result'], next: BreakerState = state;\r
    if (state === 'open') {\r
      allowed = false; result = 'shed'; next = 'open'; // fail fast, shed load\r
    } else if (state === 'half-open') {\r
      allowed = true; result = req.upstream;\r
      next = req.upstream === 'success' ? 'closed' : 'open';\r
      if (next === 'open') openedAt = req.t;\r
      fails = 0;\r
    } else { // closed\r
      allowed = true; result = req.upstream;\r
      if (req.upstream === 'failure') { fails++; if (fails >= cfg.failThreshold) { next = 'open'; openedAt = req.t; fails = 0; } }\r
      else fails = 0;\r
    }\r
    steps.push({ t: req.t, state: before, allowed, result, nextState: next });\r
    state = next;\r
  }\r
  return steps;\r
}\r
`;export{e as default};