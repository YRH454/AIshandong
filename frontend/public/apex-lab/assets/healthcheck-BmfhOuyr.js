var e=`// Liveness vs readiness probes — the Kubernetes distinction that, gotten wrong, causes restart storms.\r
// They answer different questions. READINESS: "should this instance receive traffic right now?" — if it\r
// fails, the load balancer simply stops routing to the pod (no restart); when it passes again, traffic\r
// resumes. Use it for warm-up, a full connection pool, or a temporary dependency outage. LIVENESS:\r
// "is this instance wedged and beyond saving?" — if it fails \`failureThreshold\` times in a row, the\r
// kubelet KILLS and restarts the container. Use it only for true deadlocks. The classic outage: putting\r
// a slow-under-load check on the LIVENESS probe, so when traffic spikes the app gets slow, liveness\r
// times out, and Kubernetes restarts every pod at once — turning a blip into a crashloop. The fix is to\r
// make that a readiness check (shed traffic) instead. Reference: Kubernetes docs, "Configure Liveness,\r
// Readiness and Startup Probes"; Google SRE.\r
\r
export type Probe = 'pass' | 'fail';\r
export interface Tick { liveness: Probe; readiness: Probe }\r
export interface State { phase: 'starting' | 'live'; ready: boolean; serving: boolean; livenessFails: number; restarts: number }\r
export interface StepResult { state: State; restarted: boolean; note: string }\r
\r
export const initState = (): State => ({ phase: 'starting', ready: false, serving: false, livenessFails: 0, restarts: 0 });\r
\r
/** Apply one probe cycle. Liveness failures accumulate toward a restart; readiness only gates traffic. */\r
export function step(s: State, t: Tick, failureThreshold = 3): StepResult {\r
  // liveness first — a restart supersedes everything\r
  if (t.liveness === 'fail') {\r
    const fails = s.livenessFails + 1;\r
    if (fails >= failureThreshold) {\r
      return { state: { phase: 'starting', ready: false, serving: false, livenessFails: 0, restarts: s.restarts + 1 }, restarted: true,\r
        note: \`liveness failed \${fails}× → container KILLED and restarted (restart #\${s.restarts + 1})\` };\r
    }\r
    // failing but not yet at the threshold: still running, traffic still gated by readiness\r
    const ready = t.readiness === 'pass';\r
    return { state: { ...s, phase: 'live', ready, serving: ready, livenessFails: fails }, restarted: false,\r
      note: \`liveness failing (\${fails}/\${failureThreshold}) — not restarted yet\` };\r
  }\r
\r
  // liveness healthy → readiness decides traffic\r
  const ready = t.readiness === 'pass';\r
  return { state: { phase: 'live', ready, serving: ready, livenessFails: 0, restarts: s.restarts }, restarted: false,\r
    note: ready ? 'healthy & ready — receiving traffic' : 'alive but NOT ready → removed from the load balancer (no restart)' };\r
}\r
\r
/** Run a probe sequence from a fresh start; returns the state after each tick. */\r
export function run(ticks: Tick[], failureThreshold = 3): StepResult[] {\r
  let s = initState();\r
  return ticks.map((t) => { const r = step(s, t, failureThreshold); s = r.state; return r; });\r
}\r
`;export{e as default};