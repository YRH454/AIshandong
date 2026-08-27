var e=`// Happy Eyeballs (RFC 8305) — how a dual-stack client connects fast without getting stuck on\r
// a broken IPv6 path. The old behavior tried IPv6, and if it hung you waited a full TCP\r
// timeout (tens of seconds) before falling back to IPv4 — a terrible experience on networks\r
// with flaky IPv6. Happy Eyeballs instead RACES the two: it starts the IPv6 connection first\r
// (IPv6 is preferred), and if it hasn't completed within a short "Connection Attempt Delay"\r
// (~250 ms), it starts IPv4 in parallel and uses whichever connects first — preferring IPv6\r
// on a tie. A failing IPv6 path is bypassed in a fraction of a second instead of stalling.\r
// Pure timing model, tested.\r
\r
export interface Endpoint { connectMs: number | null; failMs: number | null } // exactly one set, or both null = timeout\r
export interface Race {\r
  ipv4StartMs: number;     // when the IPv4 attempt is launched\r
  ipv6ConnectMs: number | null;\r
  ipv4ConnectMs: number | null; // absolute time (from t=0)\r
  winner: 'IPv6' | 'IPv4' | null;\r
  connectMs: number | null;\r
}\r
\r
/** Race IPv6 (started at t=0) against IPv4 (started after the attempt delay, or sooner if\r
 *  IPv6 has already failed). Earliest successful connect wins; ties go to IPv6. */\r
export function race(ipv6: Endpoint, ipv4: Endpoint, attemptDelayMs = 250): Race {\r
  // launch IPv4 at the attempt delay — unless IPv6 errored out earlier, then launch right away\r
  const ipv4StartMs = ipv6.failMs !== null && ipv6.failMs < attemptDelayMs ? ipv6.failMs : attemptDelayMs;\r
\r
  const ipv6ConnectMs = ipv6.connectMs;\r
  const ipv4ConnectMs = ipv4.connectMs !== null ? ipv4StartMs + ipv4.connectMs : null;\r
\r
  let winner: Race['winner'] = null, connectMs: number | null = null;\r
  if (ipv6ConnectMs !== null && (ipv4ConnectMs === null || ipv6ConnectMs <= ipv4ConnectMs)) {\r
    winner = 'IPv6'; connectMs = ipv6ConnectMs; // IPv6 preferred (incl. ties)\r
  } else if (ipv4ConnectMs !== null) {\r
    winner = 'IPv4'; connectMs = ipv4ConnectMs;\r
  }\r
  return { ipv4StartMs, ipv6ConnectMs, ipv4ConnectMs, winner, connectMs };\r
}\r
\r
export const ok = (connectMs: number): Endpoint => ({ connectMs, failMs: null });\r
export const refused = (failMs: number): Endpoint => ({ connectMs: null, failMs });\r
export const timeout = (): Endpoint => ({ connectMs: null, failMs: null });\r
`;export{e as default};