var e=`// TCP connection setup and teardown (RFC 9293). The most-drawn diagram in networking,\r
// made exact. Each side picks an Initial Sequence Number; SYN and FIN each consume one\r
// sequence number, and an ACK always carries (other side's seq + bytes/flags consumed).\r
// Both endpoints walk the TCP state machine: CLOSED → SYN_SENT/SYN_RCVD → ESTABLISHED\r
// for the 3-way open, then FIN_WAIT_1/2, CLOSE_WAIT, LAST_ACK, TIME_WAIT for the close.\r
// Pure model; the seq/ack relationships and the state path are tested against the RFC.\r
\r
export type Flag = 'SYN' | 'ACK' | 'FIN';\r
export type Dir = 'c2s' | 's2c';\r
\r
export interface Segment {\r
  step: number;\r
  dir: Dir;\r
  flags: Flag[];\r
  seq: number;\r
  ack?: number;\r
  clientState: string; // state AFTER this segment is processed\r
  serverState: string;\r
  note: string;\r
}\r
\r
/** Full open-then-close exchange given each side's Initial Sequence Number. */\r
export function handshake(c: number, s: number): Segment[] {\r
  const segs: Segment[] = [];\r
  let step = 0;\r
  const push = (dir: Dir, flags: Flag[], seq: number, ack: number | undefined, clientState: string, serverState: string, note: string) =>\r
    segs.push({ step: step++, dir, flags, seq, ack, clientState, serverState, note });\r
\r
  // ── three-way handshake ──\r
  push('c2s', ['SYN'], c, undefined, 'SYN_SENT', 'LISTEN', 'client opens: SYN, my ISN = c');\r
  push('s2c', ['SYN', 'ACK'], s, c + 1, 'SYN_SENT', 'SYN_RCVD', 'server: my ISN = s, and I ack c+1');\r
  push('c2s', ['ACK'], c + 1, s + 1, 'ESTABLISHED', 'ESTABLISHED', 'client acks s+1 — both sides open');\r
  // ── active close by the client (FIN consumes one sequence number) ──\r
  push('c2s', ['FIN', 'ACK'], c + 1, s + 1, 'FIN_WAIT_1', 'ESTABLISHED', 'client done sending: FIN');\r
  push('s2c', ['ACK'], s + 1, c + 2, 'FIN_WAIT_2', 'CLOSE_WAIT', 'server acks the FIN (may still send)');\r
  push('s2c', ['FIN', 'ACK'], s + 1, c + 2, 'FIN_WAIT_2', 'LAST_ACK', 'server done too: its own FIN');\r
  push('c2s', ['ACK'], c + 2, s + 2, 'TIME_WAIT', 'CLOSED', 'client acks; waits 2·MSL, then CLOSED');\r
  return segs;\r
}\r
\r
/** The ordered set of distinct states each side passes through (for the FSM view). */\r
export function statePath(segs: Segment[], side: 'client' | 'server'): string[] {\r
  const key = side === 'client' ? 'clientState' : 'serverState';\r
  const start = side === 'client' ? 'CLOSED' : 'CLOSED';\r
  const path = [start];\r
  for (const s of segs) {\r
    const st = s[key as 'clientState' | 'serverState'];\r
    if (st !== path[path.length - 1]) path.push(st);\r
  }\r
  if (path[path.length - 1] !== 'CLOSED') path.push('CLOSED'); // TIME_WAIT → CLOSED\r
  return path;\r
}\r
`;export{e as default};