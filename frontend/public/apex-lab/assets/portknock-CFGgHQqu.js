var e=`// Port knocking — a hidden service behind a firewall that drops everything, opened only by a secret SEQUENCE of\r
// connection attempts to closed ports (e.g. 7000 → 8000 → 9000, in order, from one source). A daemon watches the\r
// firewall's log; when it sees the exact sequence it briefly opens the real port (say SSH) for that IP. A port scan\r
// sees only closed ports, so there's nothing to attack — but it's obscurity, not authentication: anyone who can sniff\r
// the knocks can replay them (which is why fwknop/single-packet-authorization signs and encrypts the knock instead).\r
\r
export type KnockState = { progress: number; opened: boolean };\r
\r
// Process one knock. On a match, advance; when the whole sequence is done, the port opens. On a miss, reset — but a\r
// knock equal to the FIRST port starts a fresh attempt (so a stray knock doesn't permanently lock you out).\r
export function knock(state: KnockState, port: number, secret: number[]): KnockState {\r
  if (state.opened) return state;\r
  if (port === secret[state.progress]) {\r
    const progress = state.progress + 1;\r
    return { progress, opened: progress === secret.length };\r
  }\r
  return { progress: port === secret[0] ? 1 : 0, opened: false };\r
}\r
\r
// Run a whole list of knocks from the closed state.\r
export function runKnocks(secret: number[], seq: number[]): KnockState {\r
  return seq.reduce((s, p) => knock(s, p, secret), { progress: 0, opened: false } as KnockState);\r
}\r
`;export{e as default};