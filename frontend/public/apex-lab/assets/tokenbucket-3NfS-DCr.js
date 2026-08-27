var e=`// Token-bucket rate limiting — how an API caps your request rate while still\r
// allowing short bursts. A bucket holds up to C tokens and gains R tokens each tick\r
// (never above C). Every request must take one token: if the bucket is non-empty\r
// it's allowed, otherwise it's rejected (HTTP 429). So you can burst up to C\r
// requests instantly (a full bucket), but the long-run rate can't exceed R — the\r
// refill rate. This is the generic algorithm behind most rate limiters. Pure, tested.\r
\r
export interface BucketConfig {\r
  capacity: number; // C: max tokens (the burst size)\r
  refill: number; // R: tokens added per tick (the sustained rate)\r
  ticks: number;\r
  arrivals: number[] | number; // requests per tick (array or constant)\r
  initialTokens?: number; // default: full bucket\r
}\r
\r
export interface BucketTick {\r
  t: number;\r
  tokensStart: number; // tokens before refill\r
  refilled: number; // tokens actually added (capped at capacity)\r
  arrived: number; // requests this tick\r
  allowed: number; // requests that got a token\r
  rejected: number; // requests with no token (429)\r
  tokensEnd: number; // tokens left after serving\r
}\r
\r
/** Simulate the bucket over time. Refill happens first, then requests are served. */\r
export function simulateBucket(cfg: BucketConfig): BucketTick[] {\r
  const arrivalsAt = (t: number) => (Array.isArray(cfg.arrivals) ? cfg.arrivals[t] ?? 0 : cfg.arrivals);\r
  let tokens = cfg.initialTokens ?? cfg.capacity;\r
  const out: BucketTick[] = [];\r
\r
  for (let t = 0; t < cfg.ticks; t++) {\r
    const tokensStart = tokens;\r
    const refilled = Math.min(cfg.refill, cfg.capacity - tokens); // never overflow the bucket\r
    tokens += refilled;\r
\r
    const arrived = arrivalsAt(t);\r
    const allowed = Math.min(arrived, tokens); // each allowed request spends a token\r
    tokens -= allowed;\r
    const rejected = arrived - allowed;\r
\r
    out.push({ t, tokensStart, refilled, arrived, allowed, rejected, tokensEnd: tokens });\r
  }\r
  return out;\r
}\r
\r
export interface BucketStats {\r
  totalArrived: number;\r
  totalAllowed: number;\r
  totalRejected: number;\r
  acceptRate: number; // fraction allowed\r
}\r
\r
export function bucketStats(trace: BucketTick[]): BucketStats {\r
  const totalArrived = trace.reduce((s, x) => s + x.arrived, 0);\r
  const totalAllowed = trace.reduce((s, x) => s + x.allowed, 0);\r
  const totalRejected = trace.reduce((s, x) => s + x.rejected, 0);\r
  return { totalArrived, totalAllowed, totalRejected, acceptRate: totalArrived ? totalAllowed / totalArrived : 1 };\r
}\r
`;export{e as default};