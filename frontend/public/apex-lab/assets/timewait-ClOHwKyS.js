var e=`// TIME_WAIT & ephemeral-port exhaustion — why the side that closes a TCP connection can't reuse its port for a\r
// while, and how that quietly caps how many connections per second a client can open. When you close a TCP\r
// connection, the side that sent the first FIN (the "active closer") doesn't free the connection immediately —\r
// it parks it in TIME_WAIT for 2×MSL (Linux: 60s). Two reasons: (1) a delayed duplicate segment from THIS\r
// connection must not be mistaken for data on a NEW connection that reuses the same 4-tuple; (2) if the final\r
// ACK is lost, the peer will resend its FIN and this side must still be around to re-ACK it. The cost: every\r
// connection an outbound client makes uses one EPHEMERAL port (a local port from a pool of ~28k), and that\r
// port stays pinned in TIME_WAIT for 60s after close. By Little's law, ports held ≈ rate × TIME_WAIT — so a\r
// client hammering short-lived connections (think a load generator, or a service with no connection pooling\r
// talking to one backend) runs OUT of ephemeral ports and new connects fail with EADDRNOTAVAIL, even though\r
// nothing is really "busy." This models that arithmetic. Reference: RFC 793 / 1122 (TIME_WAIT); the classic\r
// "TIME_WAIT and port exhaustion" ops write-ups.\r
\r
export interface Params {\r
  connRate: number;    // new outbound connections per second (to a single destination)\r
  timeWaitSec: number; // how long each closed connection pins its ephemeral port (2×MSL)\r
  portPool: number;    // size of the ephemeral port range (e.g. 61000-32768 ≈ 28232)\r
}\r
\r
export interface Result {\r
  portsHeld: number;      // ports pinned in TIME_WAIT at steady state (Little's law: rate × time)\r
  exhausted: boolean;     // demand exceeds the pool → new connects fail (EADDRNOTAVAIL)\r
  utilizationPct: number; // portsHeld / portPool\r
  maxRate: number;        // the highest sustainable connect rate for this pool + TIME_WAIT\r
}\r
\r
/** Steady-state ephemeral-port pressure from a sustained connection rate. */\r
export function analyze(p: Params): Result {\r
  const portsHeld = p.connRate * p.timeWaitSec;      // Little's law: occupancy = arrival rate × hold time\r
  const maxRate = p.portPool / p.timeWaitSec;\r
  return {\r
    portsHeld,\r
    exhausted: portsHeld > p.portPool,\r
    utilizationPct: (portsHeld / p.portPool) * 100,\r
    maxRate,\r
  };\r
}\r
\r
/** Max sustainable connects/sec before exhaustion, given the pool and TIME_WAIT. */\r
export const maxSustainableRate = (portPool: number, timeWaitSec: number): number => portPool / timeWaitSec;\r
`;export{e as default};