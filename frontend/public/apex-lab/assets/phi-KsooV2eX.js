var e=`// The phi-accrual failure detector (Hayashibara et al., 2004) — how a distributed system decides a\r
// peer is dead without a brittle fixed timeout. A node sends heartbeats; the detector watches their\r
// inter-arrival times, fits a normal distribution to the recent ones, and for the current silence\r
// outputs a SUSPICION LEVEL phi = -log10(P_later), where P_later is the probability that a heartbeat\r
// arrives even later than the time we've already waited. phi rises smoothly the longer we wait, and\r
// — crucially — it ADAPTS: on a jittery link (high variance) the same silence yields a lower phi, so\r
// the detector tolerates the jitter instead of crying wolf. You act on a threshold (e.g. phi > 8 ≈\r
// a 1-in-10^8 chance the node is merely slow). This is the detector inside Cassandra, Akka, and\r
// Hazelcast. Pure, tested against the normal-distribution values the paper's formula prescribes.\r
\r
/** Abramowitz & Stegun 7.1.26 approximation of the error function (max abs error ~1.5e-7). */\r
export function erf(x: number): number {\r
  const t = 1 / (1 + 0.3275911 * Math.abs(x));\r
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);\r
  return x >= 0 ? y : -y;\r
}\r
\r
/** Normal CDF: P(X ≤ x) for X ~ N(mu, sigma²). */\r
export const normalCdf = (x: number, mu: number, sigma: number): number => 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));\r
\r
export interface Stats { mu: number; sigma: number }\r
export function stats(samples: number[], minSigma = 1): Stats {\r
  const n = samples.length;\r
  if (n === 0) return { mu: 0, sigma: minSigma };\r
  const mu = samples.reduce((a, b) => a + b, 0) / n;\r
  const variance = samples.reduce((a, b) => a + (b - mu) ** 2, 0) / n;\r
  return { mu, sigma: Math.max(minSigma, Math.sqrt(variance)) };\r
}\r
\r
/** phi = -log10(P_later(gap)) where P_later(t) = 1 - CDF(t): the unlikelihood of this silence. */\r
export function phi(gap: number, mu: number, sigma: number): number {\r
  const pLater = 1 - normalCdf(gap, mu, sigma);\r
  return -Math.log10(Math.max(pLater, 1e-12)); // clamp so phi stays finite when P_later underflows\r
}\r
\r
/** phi at time \`now\`, using the last \`window\` inter-arrival gaps of the heartbeat stream. */\r
export function phiAt(arrivals: number[], now: number, window = 100, minSigma = 1): number {\r
  const seen = arrivals.filter((t) => t <= now);\r
  if (seen.length < 2) return 0;\r
  const intervals: number[] = [];\r
  for (let i = 1; i < seen.length; i++) intervals.push(seen[i] - seen[i - 1]);\r
  const s = stats(intervals.slice(-window), minSigma);\r
  return phi(now - seen[seen.length - 1], s.mu, s.sigma);\r
}\r
`;export{e as default};