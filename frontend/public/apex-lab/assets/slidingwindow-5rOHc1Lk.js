var e=`// TCP sliding window — flow control (the receiver's advertised window, rwnd) and\r
// how it combines with congestion control (cwnd) to decide how much the sender may\r
// have outstanding. The sender's byte stream splits into four regions:\r
//   acked        — sent and acknowledged; the window has slid past these\r
//   inFlight     — sent but not yet acked (sent-unacked)\r
//   sendable     — within the window, may be sent right now\r
//   blocked      — beyond the window; must wait for the window to slide\r
// The send window = min(rwnd, cwnd); usable window = send window − bytesInFlight.\r
// Refs: RFC 9293 §3.8 (flow control), RFC 5681 (cwnd). Pure, tested.\r
\r
export interface WindowState {\r
  sndUna: number; // first unacknowledged byte (left edge of the window)\r
  sndNxt: number; // next byte to send (boundary between inFlight and sendable)\r
  rwnd: number; // receiver advertised window\r
  cwnd: number; // congestion window\r
  total: number; // total bytes the app wants to send (stream length)\r
}\r
\r
export interface WindowView {\r
  sendWindow: number; // min(rwnd, cwnd)\r
  windowRight: number; // sndUna + sendWindow (right edge)\r
  bytesInFlight: number; // sndNxt - sndUna\r
  usableWindow: number; // how many more bytes may be sent right now (>= 0)\r
  zeroWindow: boolean; // receiver has advertised rwnd = 0 (sender must stall)\r
  regions: { acked: [number, number]; inFlight: [number, number]; sendable: [number, number]; blocked: [number, number] };\r
}\r
\r
/** Derive the four byte regions and the usable window from a window state. */\r
export function windowView(s: WindowState): WindowView {\r
  const sendWindow = Math.min(s.rwnd, s.cwnd);\r
  const windowRight = Math.min(s.sndUna + sendWindow, s.total);\r
  const bytesInFlight = s.sndNxt - s.sndUna;\r
  const usableWindow = Math.max(0, windowRight - s.sndNxt);\r
  return {\r
    sendWindow,\r
    windowRight,\r
    bytesInFlight,\r
    usableWindow,\r
    zeroWindow: s.rwnd === 0,\r
    regions: {\r
      acked: [0, s.sndUna],\r
      inFlight: [s.sndUna, s.sndNxt],\r
      sendable: [s.sndNxt, windowRight],\r
      blocked: [windowRight, s.total],\r
    },\r
  };\r
}\r
\r
/** Send up to \`n\` bytes (bounded by the usable window): advances sndNxt. */\r
export function send(s: WindowState, n: number): WindowState {\r
  const usable = windowView(s).usableWindow;\r
  return { ...s, sndNxt: s.sndNxt + Math.min(n, usable) };\r
}\r
\r
/** An ACK acknowledges up to \`ackedBytes\`, sliding the left edge forward. */\r
export function ack(s: WindowState, ackedBytes: number): WindowState {\r
  const sndUna = Math.min(s.sndUna + Math.max(0, ackedBytes), s.sndNxt);\r
  return { ...s, sndUna };\r
}\r
\r
/** The receiver re-advertises a new window (e.g. its buffer filled or drained). */\r
export function advertise(s: WindowState, rwnd: number): WindowState {\r
  return { ...s, rwnd: Math.max(0, rwnd) };\r
}\r
`;export{e as default};