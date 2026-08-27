var e=`// Chaos engineering — deliberately breaking one thing to discover how far the damage spreads, and\r
// proving your resilience actually contains it. Services depend on each other; when one goes DOWN, every\r
// service with a HARD dependency on a down service goes down too, and the failure cascades up to the\r
// user. A RESILIENT service (one with a fallback, cached default, or sensible timeout) instead stays up\r
// in a DEGRADED mode when a dependency dies — which is exactly what stops a single backend hiccup from\r
// taking down the whole product. The "blast radius" is the set of services that actually go down; the\r
// goal of a chaos experiment is to inject a failure and confirm the blast radius is as small as your\r
// steady-state hypothesis says. Reference: Netflix Chaos Monkey / Principles of Chaos; Google SRE.\r
\r
export interface Service { id: string; deps: string[]; resilient: boolean }\r
export type Status = 'up' | 'degraded' | 'down';\r
export interface ChaosResult { status: Record<string, Status>; down: string[]; degraded: string[] }\r
\r
/** Evaluate the fleet when \`failedId\` is injected as DOWN. A service is down if it failed or has a\r
 *  hard (non-resilient) dependency that is down; a resilient service degrades instead of going down.\r
 *  A degraded dependency still responds, so it does NOT take its callers down. Computed as a monotone\r
 *  fixpoint over the down-set, so it's correct and order-independent even for CYCLIC dependency graphs. */\r
export function evaluate(services: Service[], failedId: string | null): ChaosResult {\r
  const down = new Set<string>();\r
  if (failedId !== null) down.add(failedId);\r
\r
  // Grow the down-set until stable: any non-failed, non-resilient service with a down dependency goes\r
  // down. 'down' only ever spreads (the injected failure never recovers), so this converges; a cycle of\r
  // hard dependencies that touches a down service collapses entirely, independent of array order.\r
  let changed = true;\r
  while (changed) {\r
    changed = false;\r
    for (const s of services) {\r
      if (down.has(s.id) || s.resilient) continue;            // already down, or it degrades instead\r
      if (s.deps.some((d) => down.has(d))) { down.add(s.id); changed = true; }\r
    }\r
  }\r
\r
  const status: Record<string, Status> = {};\r
  const degraded: string[] = [];\r
  for (const s of services) {\r
    if (down.has(s.id)) status[s.id] = 'down';\r
    else if (s.deps.some((d) => down.has(d))) { status[s.id] = 'degraded'; degraded.push(s.id); } // resilient + down dep\r
    else status[s.id] = 'up';\r
  }\r
  return { status, down: services.filter((s) => down.has(s.id)).map((s) => s.id), degraded };\r
}\r
`;export{e as default};