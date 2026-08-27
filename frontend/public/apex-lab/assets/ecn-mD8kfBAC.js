var e=`// Explicit Congestion Notification (ECN, RFC 3168) — telling a sender to slow down WITHOUT throwing\r
// its packet away. Normally a router signals congestion the only way it can: it drops a packet, and\r
// the loss tells TCP to back off — but a drop costs a retransmit and a latency spike. ECN lets the\r
// router instead MARK the packet. Two bits in the IP header (the ECN field) carry the state:\r
//   00 Not-ECT (endpoint isn't ECN-capable) · 10 ECT(0) / 01 ECT(1) (is capable) · 11 CE (Congestion Experienced).\r
// A congested router marks an ECT packet to CE instead of dropping it; the receiver echoes that back\r
// with the TCP ECE flag; the sender halves its window (exactly as if it had seen a loss) and sets CWR\r
// to acknowledge. Same congestion response, no packet lost, no retransmit. We model the router's\r
// per-packet decision and the CE→ECE→CWR signaling round. Pure, tested against RFC 3168.\r
\r
export type ECN = 'Not-ECT' | 'ECT(0)' | 'ECT(1)' | 'CE';\r
export const isECT = (c: ECN): boolean => c === 'ECT(0)' || c === 'ECT(1)';\r
\r
export interface RouterDecision { codepoint: ECN; action: 'forward' | 'mark' | 'drop'; note: string }\r
\r
/** What a router does to a packet given its congestion state (RFC 3168 §5, §6). */\r
export function routerHandle(codepoint: ECN, congested: boolean): RouterDecision {\r
  if (!congested) return { codepoint, action: 'forward', note: 'queue has room — forward unchanged' };\r
  if (codepoint === 'CE') return { codepoint, action: 'forward', note: 'already marked CE upstream — forward' };\r
  if (isECT(codepoint)) return { codepoint: 'CE', action: 'mark', note: 'ECN-capable → MARK Congestion Experienced instead of dropping' };\r
  return { codepoint, action: 'drop', note: 'not ECN-capable → the only signal available is to DROP' };\r
}\r
\r
export interface FlowResult {\r
  ecn: boolean;\r
  marks: number; // CE marks (ECN flow)\r
  drops: number; // packets dropped (non-ECN flow)\r
  retransmits: number; // == drops (each lost packet must be resent)\r
  cwndHalvings: number; // congestion responses (same either way)\r
  delivered: number;\r
}\r
\r
/** Push \`n\` packets through a router that is congested on a given fraction, with/without ECN, and\r
 *  compare the cost. Both back off the same; only ECN avoids the drops and their retransmits. */\r
export function runFlow(n: number, congestedEvery: number, ecn: boolean): FlowResult {\r
  let marks = 0, drops = 0, halvings = 0, delivered = 0;\r
  let lastSignalAt = -Infinity;\r
  for (let i = 0; i < n; i++) {\r
    const congested = congestedEvery > 0 && i % congestedEvery === 0 && i > 0;\r
    const d = routerHandle(ecn ? 'ECT(0)' : 'Not-ECT', congested);\r
    if (d.action === 'drop') { drops++; }\r
    else { delivered++; if (d.action === 'mark') marks++; }\r
    // one cwnd halving per congestion signal (a mark or a drop), at most once per "RTT" window\r
    if ((d.action === 'mark' || d.action === 'drop') && i - lastSignalAt > 1) { halvings++; lastSignalAt = i; }\r
  }\r
  return { ecn, marks, drops, retransmits: drops, cwndHalvings: halvings, delivered };\r
}\r
`;export{e as default};