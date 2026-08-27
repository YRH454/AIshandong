var e=`// Graceful shutdown / connection draining — how to take an instance down WITHOUT dropping the requests\r
// it's already serving. When the orchestrator sends SIGTERM, a naive process exits immediately and every\r
// in-flight request becomes a 5xx. The graceful sequence instead: (1) fail the readiness probe so the\r
// load balancer stops sending NEW requests (this takes a moment to propagate — until then new requests\r
// still arrive and must be accepted), (2) keep serving in-flight requests until they finish, (3) exit\r
// once drained. A termination grace period bounds the wait: anything still running when it expires is\r
// force-killed (SIGKILL) and those connections DO drop. So the budget you want is grace period ≥ your\r
// longest normal request. This is the same dance rolling deploys and autoscale-down rely on every day.\r
// Reference: Kubernetes pod termination lifecycle (preStop, terminationGracePeriodSeconds); SRE practice.\r
\r
export interface Req { id: string; arrival: number; duration: number } // arrival relative to SIGTERM (negative = already in flight)\r
export type Outcome = 'completed' | 'dropped' | 'rejected';\r
export interface ReqResult extends Req { finish: number; outcome: Outcome }\r
export interface ShutdownResult { results: ReqResult[]; completed: number; dropped: number; rejected: number; cleanExit: boolean; drainNeeded: number }\r
\r
/** SIGTERM lands at t=0. For \`readinessDelay\` ticks the LB still routes new requests here (probe hasn't\r
 *  propagated); after that, new arrivals are rejected (sent elsewhere — fine). At \`gracePeriod\` the\r
 *  process is force-killed, dropping anything still running. */\r
export function shutdown(reqs: Req[], readinessDelay: number, gracePeriod: number): ShutdownResult {\r
  const results: ReqResult[] = reqs.map((r) => {\r
    const finish = r.arrival + r.duration;\r
    let outcome: Outcome;\r
    if (r.arrival > readinessDelay) outcome = 'rejected';        // arrived after the LB stopped routing here\r
    else if (finish > gracePeriod) outcome = 'dropped';          // still running when force-killed\r
    else outcome = 'completed';                                   // finished within the grace period\r
    return { ...r, finish, outcome };\r
  });\r
  const count = (o: Outcome) => results.filter((r) => r.outcome === o).length;\r
  // how long draining the accepted requests actually needs (longest finish among non-rejected)\r
  const drainNeeded = Math.max(0, ...results.filter((r) => r.outcome !== 'rejected').map((r) => r.finish));\r
  return {\r
    results, completed: count('completed'), dropped: count('dropped'), rejected: count('rejected'),\r
    cleanExit: count('dropped') === 0, drainNeeded,\r
  };\r
}\r
`;export{e as default};