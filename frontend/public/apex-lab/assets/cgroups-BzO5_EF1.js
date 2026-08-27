var e=`// cgroups v2 — how the kernel caps what a process can USE (the other half of a container; namespaces cap what it can\r
// SEE). Three controllers with three distinct effects. cpu.max is a quota/period pair: a task may run for \`quota\`\r
// microseconds out of every \`period\`, so a CPU-hungry task runs full then is throttled (paused) for the rest of each\r
// period — its throughput is capped at quota/period. memory.max triggers the OOM killer when the working set can't fit.\r
// pids.max makes fork() return EAGAIN past the cap, so a fork bomb can't exhaust the host's process table. This models\r
// the three limit semantics; it isn't the scheduler, but the caps match how cgroups behave.\r
\r
// ---- CPU (cpu.max = quota/period) ----\r
export interface CpuResult { effectivePct: number; throttled: boolean; throttledPct: number }\r
// quotaPct and demandPct are percentages of one core (100 = a full core).\r
export function cpuThrottle(quotaPct: number, demandPct: number): CpuResult {\r
  const effectivePct = Math.min(demandPct, quotaPct);\r
  const throttled = demandPct > quotaPct;\r
  // Of the CPU it wanted, the fraction it was denied (0 when it fits under quota).\r
  const throttledPct = throttled ? Math.round(((demandPct - quotaPct) / demandPct) * 100) : 0;\r
  return { effectivePct, throttled, throttledPct };\r
}\r
\r
// ---- Memory (memory.max) ----\r
export interface MemResult { usedMb: number; oom: boolean }\r
export function memoryOutcome(needMb: number, limitMb: number): MemResult {\r
  const oom = needMb > limitMb;\r
  return { usedMb: oom ? limitMb : needMb, oom };\r
}\r
\r
// ---- PIDs (pids.max) ----\r
export interface PidsResult { running: number; failedForks: number; contained: boolean }\r
export function pidsOutcome(demand: number, limitMax: number): PidsResult {\r
  const running = Math.min(demand, limitMax);\r
  const failedForks = Math.max(0, demand - limitMax);\r
  return { running, failedForks, contained: demand > limitMax };\r
}\r
`;export{e as default};