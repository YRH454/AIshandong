var e=`// 0-RTT resumption & the replay problem — how TLS 1.3 / QUIC send application data in the VERY FIRST packet\r
// (zero round trips to the first byte), and the sharp edge that comes with it. On a first visit the client\r
// does a normal handshake and the server hands it a RESUMPTION TICKET (a pre-shared key, PSK). On the next\r
// visit the client can encrypt request data with that PSK and attach it as EARLY DATA to its first flight —\r
// the server can act on it before completing the handshake. The catch: early data has NO server-contributed\r
// freshness yet, so a network attacker who captured it can REPLAY the same bytes and the server will process\r
// them again. That's fine for idempotent/safe requests (a GET) but catastrophic for a POST that charges a\r
// card or ships an order. So the rule is: only put replay-safe requests in 0-RTT. References: RFC 8446 §2.3 &\r
// §8 (TLS 1.3, anti-replay); RFC 9001 (QUIC).\r
\r
export type Mode = 'full' | 'resume' | '0rtt';\r
export interface ConnResult { mode: Mode; rttToFirstByte: number; usesTicket: boolean; earlyData: boolean; replayable: boolean }\r
\r
/** Establish a connection. 0-RTT and plain resumption both need a ticket from a prior visit; without one they\r
 *  fall back to a full handshake. Only 0-RTT carries early data (rtt 0) — and only 0-RTT early data is\r
 *  replayable. (RTT here is QUIC-style: a full handshake is 1 RTT to first byte, 0-RTT is 0.) */\r
export function connect(mode: Mode, hasTicket: boolean): ConnResult {\r
  if ((mode === '0rtt' || mode === 'resume') && !hasTicket) mode = 'full'; // no ticket → must do the full handshake\r
  if (mode === '0rtt') return { mode, rttToFirstByte: 0, usesTicket: true, earlyData: true, replayable: true };\r
  if (mode === 'resume') return { mode, rttToFirstByte: 1, usesTicket: true, earlyData: false, replayable: false };\r
  return { mode: 'full', rttToFirstByte: 1, usesTicket: false, earlyData: false, replayable: false };\r
}\r
\r
// Two DISTINCT properties (RFC 9110). SAFE = no side effects → the conservative set browsers/CDNs actually\r
// permit in 0-RTT early data. IDEMPOTENT = repeating the request has the same effect as doing it once → this\r
// is what decides whether a REPLAY is harmful. Note PUT/DELETE are idempotent but NOT safe.\r
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);\r
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE']);\r
\r
/** Whether a method is safe to place in 0-RTT early data (no side effects) — the eligibility rule. */\r
export const safeForEarlyData = (method: string): boolean => SAFE_METHODS.has(method.toUpperCase());\r
/** Whether repeating the method is harmless (same effect as once) — what makes a REPLAY non-damaging. */\r
export const isIdempotent = (method: string): boolean => IDEMPOTENT_METHODS.has(method.toUpperCase());\r
\r
export interface ReplayOutcome { deliveries: number; logicalEffects: number; harmful: boolean }\r
\r
/** What happens if 0-RTT early data carrying \`method\` is replayed \`deliveries\` times. An IDEMPOTENT request\r
 *  has the same effect no matter how many times it lands (1 logical effect); a non-idempotent one (POST,\r
 *  PATCH) applies once per delivery — the double-charge / duplicate-order bug. */\r
export function replay(method: string, deliveries: number): ReplayOutcome {\r
  const idem = isIdempotent(method);\r
  const logicalEffects = idem ? Math.min(1, deliveries) : deliveries;\r
  return { deliveries, logicalEffects, harmful: !idem && deliveries > 1 };\r
}\r
`;export{e as default};