var e=`// Deployment strategies — how you ship v2 without (usually) taking the service down. Same goal, very\r
// different risk/cost trade-offs, and they're best understood by watching the fleet change version and\r
// the traffic re-route step by step:\r
//   • recreate   — stop all v1, start all v2. Simplest, but a window of full DOWNTIME.\r
//   • rolling    — replace instances a batch at a time. Zero downtime, but v1 and v2 serve at once\r
//                  (must be compatible) and capacity dips by a batch during each swap.\r
//   • blue-green — stand up a full v2 environment beside v1, smoke-test it at 0% traffic, then flip the\r
//                  router atomically. Instant cutover and instant rollback, but needs 2× capacity.\r
//   • canary     — send a small slice of traffic to one v2 instance, watch error rate/latency, then ramp.\r
//                  Safest for catching a bad release, at the cost of a slower, more complex rollout.\r
// Each strategy is a deterministic sequence of fleet states; availability falls straight out of how many\r
// instances are up. Reference: Humble & Farley, "Continuous Delivery"; Google SRE Workbook (canarying).\r
\r
export type Version = 'v1' | 'v2' | 'down';\r
export type Strategy = 'recreate' | 'rolling' | 'bluegreen' | 'canary';\r
export interface Step { instances: Version[]; trafficV2: number; phase: string }\r
\r
export const availability = (s: Step) => Math.round((s.instances.filter((v) => v !== 'down').length / s.instances.length) * 100);\r
const fill = (n: number, v: Version) => Array<Version>(n).fill(v);\r
const countV2 = (a: Version[]) => a.filter((v) => v === 'v2').length;\r
\r
export function simulate(strategy: Strategy, n: number, batch = 1): Step[] {\r
  switch (strategy) {\r
    case 'recreate':\r
      return [\r
        { instances: fill(n, 'v1'), trafficV2: 0, phase: 'v1 in production' },\r
        { instances: fill(n, 'down'), trafficV2: 0, phase: 'all v1 stopped — DOWNTIME while v2 boots' },\r
        { instances: fill(n, 'v2'), trafficV2: 100, phase: 'v2 started — back online' },\r
      ];\r
\r
    case 'rolling': {\r
      const steps: Step[] = [{ instances: fill(n, 'v1'), trafficV2: 0, phase: 'v1 in production' }];\r
      let cur = fill(n, 'v1');\r
      for (let i = 0; i < n; i += batch) {\r
        const draining = [...cur];\r
        for (let j = i; j < Math.min(i + batch, n); j++) draining[j] = 'down';\r
        steps.push({ instances: draining, trafficV2: Math.round((countV2(draining) / n) * 100), phase: \`draining \${Math.min(batch, n - i)} instance(s) → capacity dips\` });\r
        cur = [...cur];\r
        for (let j = i; j < Math.min(i + batch, n); j++) cur[j] = 'v2';\r
        steps.push({ instances: cur, trafficV2: Math.round((countV2(cur) / n) * 100), phase: \`\${countV2(cur)}/\${n} on v2 (v1 and v2 serve together)\` });\r
      }\r
      return steps;\r
    }\r
\r
    case 'bluegreen':\r
      return [\r
        { instances: fill(n, 'v1'), trafficV2: 0, phase: 'green (v1) live; blue (v2) provisioned in parallel' },\r
        { instances: fill(n, 'v1'), trafficV2: 0, phase: 'blue (v2) fully up & smoke-tested — still 0% traffic' },\r
        { instances: fill(n, 'v2'), trafficV2: 100, phase: 'atomic router flip → blue (v2) live; green kept warm for instant rollback' },\r
      ];\r
\r
    case 'canary': {\r
      const one = fill(n, 'v1'); one[0] = 'v2';\r
      const half = Array.from({ length: n }, (_, i) => (i < Math.ceil(n / 2) ? 'v2' : 'v1') as Version);\r
      return [\r
        { instances: fill(n, 'v1'), trafficV2: 0, phase: '100% on v1' },\r
        { instances: one, trafficV2: 5, phase: 'one canary on v2 — route 5% of traffic, watch error rate & latency' },\r
        { instances: half, trafficV2: 50, phase: 'canary healthy → ramp to 50%' },\r
        { instances: fill(n, 'v2'), trafficV2: 100, phase: 'full rollout to v2' },\r
      ];\r
    }\r
  }\r
}\r
\r
export const STRATEGY_LABEL: Record<Strategy, string> = { recreate: 'Recreate', rolling: 'Rolling', bluegreen: 'Blue-green', canary: 'Canary' };\r
/** The minimum availability across a strategy's rollout — 0 means it has a downtime window. */\r
export const minAvailability = (steps: Step[]) => Math.min(...steps.map(availability));\r
`;export{e as default};