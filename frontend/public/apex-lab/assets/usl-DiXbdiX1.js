var e=`// Universal Scalability Law (USL) — the model that explains why throwing more workers at a system eventually\r
// stops helping, and then starts actively HURTING. Amdahl's law already tells you that a serial fraction caps\r
// speedup: if a fraction of the work can't be parallelized, adding cores gives diminishing returns toward a\r
// ceiling. The USL (Neil Gunther) adds a second, nastier effect. Real systems don't just serialize — the\r
// workers also have to COORDINATE: take locks, invalidate each other's caches, gossip state, reconcile. That\r
// crosstalk grows with the number of PAIRS of workers (∝ N²), so past a point the coordination cost outruns the\r
// extra capacity and throughput goes RETROGRADE — the curve peaks and comes back down. The formula for relative\r
// throughput at concurrency N is:\r
//     C(N) = N / (1 + α(N−1) + βN(N−1))\r
// where α is the CONTENTION coefficient (serialization — the Amdahl part) and β is the COHERENCY coefficient\r
// (pairwise coordination — the retrograde part). With β=0 you recover Amdahl (a ceiling of 1/α). With β>0 there\r
// is an optimal concurrency N* = √((1−α)/β) beyond which adding workers makes things slower — the reason a\r
// database or thread pool often has a sweet-spot connection/thread count and degrades if you exceed it. Fitting\r
// α and β to a few load-test points lets you predict the peak before you hit it. Reference: Gunther, "Guerrilla\r
// Capacity Planning" (the USL).\r
\r
/** Relative throughput (speedup vs N=1) at concurrency N, given contention α and coherency β. */\r
export function throughput(n: number, alpha: number, beta: number): number {\r
  return n / (1 + alpha * (n - 1) + beta * n * (n - 1));\r
}\r
\r
/** The concurrency that maximizes throughput: N* = sqrt((1−α)/β). Infinity when β=0 (no retrograde). */\r
export function peakConcurrency(alpha: number, beta: number): number {\r
  return beta > 0 ? Math.sqrt((1 - alpha) / beta) : Infinity;\r
}\r
\r
/** Amdahl ceiling (β=0 asymptote): throughput can never exceed 1/α. Infinity when α=0. */\r
export function amdahlCeiling(alpha: number): number {\r
  return alpha > 0 ? 1 / alpha : Infinity;\r
}\r
\r
/** Sample the curve for N = 1..maxN. */\r
export function curve(alpha: number, beta: number, maxN: number): { n: number; c: number }[] {\r
  return Array.from({ length: maxN }, (_, i) => ({ n: i + 1, c: throughput(i + 1, alpha, beta) }));\r
}\r
`;export{e as default};