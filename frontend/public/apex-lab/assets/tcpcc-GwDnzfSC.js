var e=`// TCP congestion control (Reno) — the cwnd/ssthresh state machine that decides\r
// how fast a sender may push, per RTT round. Slow start grows the window\r
// exponentially (×2 each RTT) until it reaches ssthresh; then congestion\r
// avoidance grows it linearly (+1 MSS per RTT). A loss halves ssthresh: a triple-\r
// duplicate-ACK (fast retransmit) drops cwnd to the new ssthresh and continues in\r
// avoidance; a timeout collapses cwnd to 1 and restarts slow start. This is the\r
// classic AIMD sawtooth (RFC 5681). Pure integer-ish math, tested.\r
\r
export type Phase = 'slow-start' | 'congestion-avoidance';\r
export type LossKind = 'none' | 'triple-dup-ack' | 'timeout';\r
\r
export interface CcRound {\r
  rtt: number; // round index (0-based)\r
  cwnd: number; // congestion window AT THE START of this round (in MSS)\r
  ssthresh: number;\r
  phase: Phase;\r
  event: LossKind; // a loss detected DURING this round (applied to the next)\r
}\r
\r
export interface CcConfig {\r
  rounds: number;\r
  initialSsthresh: number;\r
  initialCwnd?: number;\r
  /** RTT round index → loss kind injected at that round. */\r
  losses?: Record<number, LossKind>;\r
}\r
\r
/**\r
 * Simulate \`rounds\` RTTs of TCP Reno. Returns the per-round trace. A loss at\r
 * round r is observed at r and changes the window entering round r+1.\r
 */\r
export function simulateReno(cfg: CcConfig): CcRound[] {\r
  const losses = cfg.losses ?? {};\r
  let cwnd = cfg.initialCwnd ?? 1;\r
  let ssthresh = cfg.initialSsthresh;\r
  const trace: CcRound[] = [];\r
\r
  for (let r = 0; r < cfg.rounds; r++) {\r
    const phase: Phase = cwnd < ssthresh ? 'slow-start' : 'congestion-avoidance';\r
    const event = losses[r] ?? 'none';\r
    trace.push({ rtt: r, cwnd, ssthresh, phase, event });\r
\r
    // Apply the round's outcome to produce next round's window.\r
    if (event === 'timeout') {\r
      ssthresh = Math.max(2, Math.floor(cwnd / 2)); // RFC 5681 eq (4): floor is 2*SMSS\r
      cwnd = 1; // collapse to 1 MSS, restart slow start\r
    } else if (event === 'triple-dup-ack') {\r
      ssthresh = Math.max(2, Math.floor(cwnd / 2)); // RFC 5681 eq (4): floor is 2*SMSS\r
      cwnd = ssthresh; // fast recovery: drop to ssthresh, stay in avoidance\r
    } else if (phase === 'slow-start') {\r
      cwnd = Math.min(cwnd * 2, ssthresh); // exponential growth, capped at ssthresh\r
    } else {\r
      cwnd = cwnd + 1; // additive increase: +1 MSS per RTT\r
    }\r
  }\r
  return trace;\r
}\r
\r
/** Peak cwnd reached across a trace (handy for scaling a chart). */\r
export function peakCwnd(trace: CcRound[]): number {\r
  return trace.reduce((m, r) => Math.max(m, r.cwnd, r.ssthresh), 1);\r
}\r
`;export{e as default};