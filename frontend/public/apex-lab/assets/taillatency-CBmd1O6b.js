var e=`// Tail latency — why the AVERAGE response time is a lie at scale, and why one slow server can wreck a\r
// whole request. Two ideas, both exactly computable. (1) Percentiles: p99 is the latency 99% of requests\r
// beat; it can be many times the median, and it's what users actually feel. (2) Fan-out amplification:\r
// if a request must wait for ALL of N independent servers, and each is slow with probability p, the\r
// request is slow with probability 1−(1−p)^N — so a "rare" 1%-tail per server becomes near-certain once\r
// you fan out to 100 of them. The fix is tail tolerance: hedged requests (send a backup copy, take the\r
// first to answer) drive the per-server slow probability from p to ~p². Reference: Dean & Barroso,\r
// "The Tail at Scale" (CACM 2013).\r
\r
/** Nearest-rank percentile: the smallest sample value that at least p% of the data is ≤. p in [0,100]. */\r
export function percentile(samples: number[], p: number): number {\r
  if (samples.length === 0) return NaN;\r
  const sorted = [...samples].sort((a, b) => a - b);\r
  const rank = Math.ceil((p / 100) * sorted.length);\r
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));\r
  return sorted[idx];\r
}\r
\r
export const mean = (s: number[]) => (s.length ? s.reduce((a, x) => a + x, 0) / s.length : NaN);\r
\r
/** P(request is slow) when it must wait for ALL n independent servers, each slow with probability p. */\r
export const fanoutTail = (p: number, n: number) => 1 - Math.pow(1 - p, n);\r
\r
/** Hedged requests: send \`copies\` independent attempts and take the fastest, so a single server's slow\r
 *  probability p becomes p^copies — then fan that reduced probability out across n servers. */\r
export const hedgedTail = (p: number, n: number, copies: number) => 1 - Math.pow(1 - Math.pow(p, copies), n);\r
\r
/** A deterministic, reproducible latency sample: a fast lognormal-ish body plus a heavy tail of spikes.\r
 *  \`tailPct\` percent of requests are slow (multiplied up), so the distribution is tunable but seed-free. */\r
export function sampleLatencies(count: number, baseMs: number, tailPct: number): number[] {\r
  const out: number[] = [];\r
  for (let i = 0; i < count; i++) {\r
    // deterministic pseudo-noise from i (no RNG): a smooth body in [0.6, 1.8]× base\r
    const body = baseMs * (0.6 + 1.2 * (0.5 + 0.5 * Math.sin(i * 1.2 + 1)) * (0.5 + 0.5 * Math.cos(i * 0.7)));\r
    const isSlow = (i * 7 + 3) % 100 < tailPct;            // every ~(100/tailPct)-th request spikes\r
    out.push(Math.round(isSlow ? body + baseMs * (4 + ((i * 13) % 6)) : body));\r
  }\r
  return out;\r
}\r
`;export{e as default};