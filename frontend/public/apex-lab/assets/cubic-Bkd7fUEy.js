var e=`// TCP CUBIC (RFC 8312) — the congestion controller most of the internet's servers use by\r
// default (Linux since 2006). Where Reno grows the window by +1 every round-trip (a slow\r
// linear climb that wastes capacity on fast, high-latency links), CUBIC grows it along a\r
// CUBIC curve of the time since the last loss: fast as it climbs back toward the window it\r
// had before the loss (W_max), cautious and flat right around W_max (probing gently), then\r
// fast again above it to discover new capacity. Crucially the curve is independent of RTT,\r
// so flows on long and short paths grow comparably. Pure model, tested against the formula.\r
\r
export const C = 0.4;    // CUBIC scaling constant\r
export const BETA = 0.7; // multiplicative decrease (Reno uses 0.5)\r
\r
/** K = cube root of (W_max · (1−β) / C): how long until the curve returns to W_max. */\r
export const cubicK = (wmax: number): number => Math.cbrt((wmax * (1 - BETA)) / C);\r
\r
/** The CUBIC window t round-trips after the last loss: W(t) = C·(t−K)³ + W_max. */\r
export function cubicWindow(wmax: number, t: number): number {\r
  const k = cubicK(wmax);\r
  return C * (t - k) ** 3 + wmax;\r
}\r
\r
export type Phase = 'slow-start' | 'cubic';\r
export interface Round { round: number; cwnd: number; wmax: number; phase: Phase; loss: boolean }\r
\r
/** Simulate \`rounds\` RTTs: slow start (×2) until the first loss, then CUBIC growth. A loss\r
 *  at a listed round sets W_max to the current window and restarts the CUBIC epoch. */\r
export function simulateCubic(rounds: number, lossRounds: number[], initialCwnd = 1): Round[] {\r
  const out: Round[] = [];\r
  let cwnd = initialCwnd, wmax = 0, epochStart = 0;\r
  let phase: Phase = 'slow-start';\r
\r
  for (let r = 0; r < rounds; r++) {\r
    const loss = lossRounds.includes(r);\r
    if (loss) {\r
      wmax = cwnd;           // remember where congestion hit\r
      epochStart = r;        // restart the CUBIC epoch (t = 0 here → window = β·W_max)\r
      phase = 'cubic';\r
      cwnd = cubicWindow(wmax, 0); // == BETA * wmax\r
    } else if (phase === 'slow-start') {\r
      cwnd = cwnd * 2;       // exponential growth until the first loss\r
    } else {\r
      cwnd = cubicWindow(wmax, r - epochStart);\r
    }\r
    out.push({ round: r, cwnd, wmax, phase, loss });\r
  }\r
  return out;\r
}\r
`;export{e as default};