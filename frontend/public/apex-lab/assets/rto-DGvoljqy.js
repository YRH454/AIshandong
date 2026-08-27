var e=`// TCP's retransmission timeout (RFC 6298, the Jacobson/Karels algorithm). TCP can't\r
// use a fixed timeout — RTT varies wildly — so it tracks a smoothed RTT (SRTT) and an\r
// RTT variation (RTTVAR) and sets RTO = SRTT + 4·RTTVAR, then clamps to ≥ 1 s. Karn's\r
// algorithm adds two rules: never take an RTT sample from a RETRANSMITTED segment (you\r
// can't tell which copy the ACK answered), and on a timeout, double the RTO\r
// (exponential backoff) until a clean ACK arrives. Exact formulas, tested.\r
\r
export const ALPHA = 1 / 8; // SRTT gain\r
export const BETA = 1 / 4; // RTTVAR gain\r
export const K = 4;\r
export const MIN_RTO = 1000; // RFC 6298: lower bound 1 second\r
export const MAX_RTO = 60000;\r
\r
const clamp = (x: number) => Math.min(MAX_RTO, Math.max(MIN_RTO, x));\r
\r
export interface RtoState { srtt: number; rttvar: number; rawRto: number; rto: number; samples: number }\r
\r
/** First RTT measurement R: SRTT=R, RTTVAR=R/2. */\r
export function first(r: number): RtoState {\r
  const srtt = r, rttvar = r / 2, raw = srtt + K * rttvar;\r
  return { srtt, rttvar, rawRto: raw, rto: clamp(raw), samples: 1 };\r
}\r
\r
/** Subsequent measurement: RTTVAR ← (1−β)RTTVAR + β|SRTT−R|; SRTT ← (1−α)SRTT + αR. */\r
export function update(s: RtoState, r: number): RtoState {\r
  const rttvar = (1 - BETA) * s.rttvar + BETA * Math.abs(s.srtt - r);\r
  const srtt = (1 - ALPHA) * s.srtt + ALPHA * r;\r
  const raw = srtt + K * rttvar;\r
  return { srtt, rttvar, rawRto: raw, rto: clamp(raw), samples: s.samples + 1 };\r
}\r
\r
/** Karn: a timeout doubles the RTO and takes NO sample (the retransmit is ambiguous). */\r
export function backoff(s: RtoState): RtoState {\r
  return { ...s, rto: clamp(s.rto * 2), rawRto: s.rawRto };\r
}\r
\r
/** Feed a measurement, honoring Karn: a retransmitted segment's RTT is ignored. */\r
export function measure(s: RtoState | null, r: number, retransmitted: boolean): RtoState {\r
  if (retransmitted) return s ? backoff(s) : first(r); // ambiguous → don't sample, back off\r
  return s ? update(s, r) : first(r);\r
}\r
`;export{e as default};