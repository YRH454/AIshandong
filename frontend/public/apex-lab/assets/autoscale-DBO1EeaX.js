var e=`// Horizontal autoscaling (Kubernetes HPA) — how a service grows and shrinks its replica count to track\r
// load, with one disarmingly simple formula:\r
//     desiredReplicas = ceil( currentReplicas × currentMetric / targetMetric )\r
// If each of 3 replicas is at 100% CPU and you target 50%, you need ceil(3 × 100/50) = 6. The current\r
// replica count cancels out, so it really just chases "total load ÷ per-replica target", but expressing\r
// it as a ratio is what lets ANY metric (CPU, requests/sec, queue depth) drive it. Two practical guards\r
// keep it from thrashing: a TOLERANCE band (don't react to a <10% deviation) and a scale-down\r
// STABILIZATION window (only shrink after load has stayed low for a while), so a brief dip doesn't tear\r
// down capacity you'll need back in seconds. Reference: Kubernetes HPA algorithm docs.\r
\r
export interface HpaOpts { target: number; min: number; max: number; tolerance?: number }\r
\r
/** The core HPA step: replicas needed to bring the per-replica metric back to target (clamped, with a\r
 *  tolerance dead-band so tiny deviations don't cause churn). */\r
export function desiredReplicas(current: number, metric: number, opts: HpaOpts): number {\r
  const tol = opts.tolerance ?? 0.1;\r
  const ratio = metric / opts.target;\r
  if (Math.abs(ratio - 1) <= tol) return clamp(current, opts);   // within the dead-band → hold\r
  return clamp(Math.ceil(current * ratio), opts);\r
}\r
const clamp = (r: number, o: HpaOpts) => Math.max(o.min, Math.min(o.max, r));\r
\r
export interface ScaleTick { t: number; load: number; replicas: number; perReplica: number; desired: number; action: 'scale up' | 'scale down' | 'hold' }\r
\r
/** Simulate the autoscaler over a load time-series. \`load\` is total demand; per-replica metric is\r
 *  load / replicas, which the HPA drives toward \`target\`. Scale-down waits \`downDelay\` ticks of low\r
 *  demand (stabilization) before actually shrinking. */\r
export function simulate(loads: number[], start: number, opts: HpaOpts, downDelay = 1): ScaleTick[] {\r
  let replicas = clamp(start, opts);\r
  let lowStreak = 0;\r
  const out: ScaleTick[] = [];\r
  for (let t = 0; t < loads.length; t++) {\r
    const load = loads[t];\r
    const perReplica = load / replicas;\r
    const want = desiredReplicas(replicas, perReplica, opts);\r
    let next = replicas, action: ScaleTick['action'] = 'hold';\r
    if (want > replicas) { next = want; action = 'scale up'; lowStreak = 0; }   // scale up immediately\r
    else if (want < replicas) {\r
      lowStreak++;\r
      if (lowStreak >= downDelay) { next = want; action = 'scale down'; lowStreak = 0; } // wait out the stabilization window\r
    } else lowStreak = 0;\r
    out.push({ t, load, replicas, perReplica, desired: want, action });\r
    replicas = next;\r
  }\r
  return out;\r
}\r
`;export{e as default};