var e=`// The bulkhead pattern — named after a ship's watertight compartments: flood one, the others stay dry and the\r
// ship floats. In a service, the "resource" is a bounded pool of threads or connections, and the "compartments"\r
// are your downstream dependencies. The classic outage: your service calls dependencies A, B, and C from one\r
// SHARED pool of N slots. C gets slow (a GC pause, a locked table, a dead replica). Requests to C pile up,\r
// each holding a slot while it waits — and because the pool is shared, they consume ALL N slots. Now calls to\r
// the perfectly-healthy A and B can't get a slot either, and your whole service goes down because of one sick\r
// dependency. The bulkhead fix: give each dependency its OWN sub-pool (cap N/k slots). When C floods, it can\r
// only exhaust its own compartment; A and B keep their slots and keep serving. You trade a little peak capacity\r
// for blast-radius containment. Slots-in-use follows Little's law: a dependency at \`rate\` req/s with \`latency\`\r
// seconds each holds rate×latency slots concurrently. Reference: Nygard, "Release It!" (Bulkheads);\r
// Hystrix/resilience4j thread-pool isolation.\r
\r
export interface Dep { name: string; rate: number; latencyMs: number } // requests/sec, per-request latency\r
\r
export interface DepOutcome { name: string; demand: number; served: number; healthy: boolean }\r
\r
export interface Result {\r
  poolSize: number;\r
  shared: { totalDemand: number; saturated: boolean; deps: DepOutcome[] };\r
  bulkhead: { capPerDep: number; deps: DepOutcome[] };\r
}\r
\r
const demandOf = (d: Dep) => d.rate * (d.latencyMs / 1000); // concurrent slots needed (Little's law)\r
\r
export function analyze(deps: Dep[], poolSize: number): Result {\r
  const totalDemand = deps.reduce((s, d) => s + demandOf(d), 0);\r
  const saturated = totalDemand > poolSize; // one shared pool: if total demand exceeds it, it's full for EVERYONE\r
\r
  const shared = {\r
    totalDemand,\r
    saturated,\r
    // when the shared pool saturates, every dependency is starved of slots — the whole service degrades\r
    deps: deps.map((d) => ({ name: d.name, demand: demandOf(d), served: saturated ? 0 : demandOf(d), healthy: !saturated })),\r
  };\r
\r
  const capPerDep = poolSize / deps.length; // each dependency gets its own compartment\r
  const bulkhead = {\r
    capPerDep,\r
    // a dependency can only exhaust its OWN cap; others are unaffected\r
    deps: deps.map((d) => {\r
      const demand = demandOf(d);\r
      return { name: d.name, demand, served: Math.min(demand, capPerDep), healthy: demand <= capPerDep };\r
    }),\r
  };\r
\r
  return { poolSize, shared, bulkhead };\r
}\r
`;export{e as default};