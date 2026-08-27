var e=`// HTTP/2 & QUIC flow control — the TWO-level credit system that keeps a fast sender from drowning a\r
// receiver, per stream AND for the whole connection at once. A sender may transmit DATA only while it\r
// holds credit on BOTH the stream's window and the connection's window; each byte sent debits both.\r
// The receiver hands back credit as it consumes data (HTTP/2 WINDOW_UPDATE; QUIC MAX_STREAM_DATA for a\r
// stream, MAX_DATA for the connection). The subtlety the single-window TCP model can't show: a stream\r
// can hold plenty of its own credit yet still stall because the shared connection window is empty —\r
// so one greedy stream starves the others. Reference: RFC 9113 §5.2 (HTTP/2), RFC 9000 §4 (QUIC).\r
\r
export interface Stream { id: number; window: number; sent: number }\r
export interface ConnState { connWindow: number; streams: Stream[] }\r
export type StallReason = 'stream' | 'connection' | null;\r
export interface SendResult { state: ConnState; sent: number; requested: number; stalled: StallReason }\r
\r
const clone = (s: ConnState): ConnState => ({ connWindow: s.connWindow, streams: s.streams.map((x) => ({ ...x })) });\r
\r
/** Send up to \`bytes\` on a stream, debiting both the stream window and the shared connection window.\r
 *  Returns how much actually went and — if short — which window was the binding constraint. */\r
export function send(state: ConnState, streamId: number, bytes: number): SendResult {\r
  const next = clone(state);\r
  const st = next.streams.find((s) => s.id === streamId);\r
  if (!st) return { state: next, sent: 0, requested: bytes, stalled: null };\r
  const allowed = Math.max(0, Math.min(bytes, st.window, next.connWindow));\r
  st.window -= allowed;\r
  st.sent += allowed;\r
  next.connWindow -= allowed;\r
  let stalled: StallReason = null;\r
  if (allowed < bytes) stalled = next.connWindow === 0 ? 'connection' : 'stream'; // connection wins if both are empty\r
  return { state: next, sent: allowed, requested: bytes, stalled };\r
}\r
\r
/** A WINDOW_UPDATE / MAX_STREAM_DATA: grant \`inc\` more credit to one stream. */\r
export function streamUpdate(state: ConnState, streamId: number, inc: number): ConnState {\r
  const next = clone(state);\r
  const st = next.streams.find((s) => s.id === streamId);\r
  if (st) st.window += inc;\r
  return next;\r
}\r
\r
/** A connection-level WINDOW_UPDATE / MAX_DATA: grant \`inc\` more credit to the whole connection. */\r
export function connUpdate(state: ConnState, inc: number): ConnState {\r
  const next = clone(state);\r
  next.connWindow += inc;\r
  return next;\r
}\r
\r
/** True when a stream is blocked purely because the SHARED connection window is empty — the\r
 *  starvation case: it still has its own credit but cannot use it. */\r
export function starvedByConnection(state: ConnState, streamId: number): boolean {\r
  const st = state.streams.find((s) => s.id === streamId);\r
  return !!st && st.window > 0 && state.connWindow === 0;\r
}\r
\r
export const initState = (connWindow: number, streams: { id: number; window: number }[]): ConnState =>\r
  ({ connWindow, streams: streams.map((s) => ({ id: s.id, window: s.window, sent: 0 })) });\r
`;export{e as default};