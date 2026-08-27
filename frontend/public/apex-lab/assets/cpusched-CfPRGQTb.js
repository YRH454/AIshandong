var e=`// CPU scheduling — the same job set run under different policies, so the trade-offs become numbers.\r
// A single CPU, integer time. Each policy produces a Gantt timeline plus the three metrics every OS\r
// textbook compares: turnaround (completion − arrival), waiting (turnaround − burst), and response\r
// (first-run − arrival). The classic results fall straight out: FCFS suffers the convoy effect, SJF\r
// minimizes average waiting among non-preemptive policies, SRTF minimizes it overall, and round-robin\r
// trades turnaround for responsiveness. Anchored to hand-derived traces (see tests), not to OS output.\r
// Reference: Arpaci-Dusseau, OSTEP ch.7–8 ("Scheduling"); Silberschatz, Operating System Concepts ch.6.\r
\r
export interface Job { id: string; arrival: number; burst: number }\r
export interface Slice { id: string; start: number; end: number }\r
export interface JobMetric { id: string; arrival: number; burst: number; completion: number; turnaround: number; waiting: number; response: number; firstRun: number }\r
export interface Schedule { gantt: Slice[]; metrics: JobMetric[]; avgTurnaround: number; avgWaiting: number; avgResponse: number }\r
export type Policy = 'fcfs' | 'sjf' | 'srtf' | 'rr';\r
\r
// Merge adjacent CPU ticks that ran the same job into one Gantt bar.\r
function coalesce(ticks: (string | null)[]): Slice[] {\r
  const out: Slice[] = [];\r
  for (let t = 0; t < ticks.length; t++) {\r
    const id = ticks[t];\r
    if (id === null) continue;\r
    const last = out[out.length - 1];\r
    if (last && last.id === id && last.end === t) last.end = t + 1;\r
    else out.push({ id, start: t, end: t + 1 });\r
  }\r
  return out;\r
}\r
\r
function finish(jobs: Job[], gantt: Slice[]): Schedule {\r
  const firstRun: Record<string, number> = {};\r
  const completion: Record<string, number> = {};\r
  for (const s of gantt) {\r
    if (firstRun[s.id] === undefined) firstRun[s.id] = s.start;\r
    completion[s.id] = s.end;\r
  }\r
  const metrics: JobMetric[] = jobs.map((j) => {\r
    const turnaround = completion[j.id] - j.arrival;\r
    return {\r
      id: j.id, arrival: j.arrival, burst: j.burst,\r
      completion: completion[j.id], turnaround, waiting: turnaround - j.burst,\r
      response: firstRun[j.id] - j.arrival, firstRun: firstRun[j.id],\r
    };\r
  });\r
  const n = metrics.length || 1;\r
  const sum = (f: (m: JobMetric) => number) => metrics.reduce((a, m) => a + f(m), 0);\r
  return {\r
    gantt, metrics,\r
    avgTurnaround: sum((m) => m.turnaround) / n,\r
    avgWaiting: sum((m) => m.waiting) / n,\r
    avgResponse: sum((m) => m.response) / n,\r
  };\r
}\r
\r
// Non-preemptive: at each decision point pick the ready job with the smallest \`key\`; if the CPU is\r
// idle, fast-forward to the next arrival. \`key\` is arrival-then-id (FCFS) or burst-then-arrival (SJF).\r
function nonPreemptive(jobs: Job[], key: (j: Job) => [number, number, string]): Schedule {\r
  const rem = new Map(jobs.map((j) => [j.id, j.burst] as const));\r
  const done = new Set<string>();\r
  const ticks: (string | null)[] = [];\r
  let t = 0;\r
  while (done.size < jobs.length) {\r
    const ready = jobs.filter((j) => !done.has(j.id) && j.arrival <= t);\r
    if (ready.length === 0) { ticks[t] = null; t++; continue; }\r
    ready.sort((a, b) => { const ka = key(a), kb = key(b); return ka[0] - kb[0] || ka[1] - kb[1] || (ka[2] < kb[2] ? -1 : 1); });\r
    const job = ready[0];\r
    for (let k = 0; k < rem.get(job.id)!; k++) ticks[t + k] = job.id;\r
    t += rem.get(job.id)!;\r
    done.add(job.id);\r
  }\r
  return finish(jobs, coalesce(ticks));\r
}\r
\r
// Preemptive shortest-remaining-time-first: every tick, run the arrived, unfinished job with the\r
// least time left (ties to earlier arrival, then id). Idle ticks advance the clock.\r
function srtf(jobs: Job[]): Schedule {\r
  const rem = new Map(jobs.map((j) => [j.id, j.burst] as const));\r
  const ticks: (string | null)[] = [];\r
  const total = jobs.reduce((a, j) => a + j.burst, 0);\r
  let t = 0, completed = 0;\r
  while (completed < total) {\r
    const ready = jobs.filter((j) => j.arrival <= t && rem.get(j.id)! > 0);\r
    if (ready.length === 0) { ticks[t] = null; t++; continue; }\r
    ready.sort((a, b) => rem.get(a.id)! - rem.get(b.id)! || a.arrival - b.arrival || (a.id < b.id ? -1 : 1));\r
    const job = ready[0];\r
    ticks[t] = job.id;\r
    rem.set(job.id, rem.get(job.id)! - 1);\r
    completed++; t++;\r
  }\r
  return finish(jobs, coalesce(ticks));\r
}\r
\r
// Round-robin: FIFO ready queue, each job runs at most \`quantum\` ticks then goes to the back. When a\r
// slice ends at time t, jobs that have arrived by t are enqueued (in arrival order) BEFORE the\r
// preempted job is re-added — the standard textbook tie-break at a quantum/arrival boundary.\r
function roundRobin(jobs: Job[], quantum: number): Schedule {\r
  const rem = new Map(jobs.map((j) => [j.id, j.burst] as const));\r
  const byArrival = [...jobs].sort((a, b) => a.arrival - b.arrival || (a.id < b.id ? -1 : 1));\r
  const ticks: (string | null)[] = [];\r
  const queue: string[] = [];\r
  const enqueued = new Set<string>();\r
  const total = jobs.reduce((a, j) => a + j.burst, 0);\r
  let t = 0, completed = 0;\r
  const admit = (upto: number) => { for (const j of byArrival) if (!enqueued.has(j.id) && j.arrival <= upto) { queue.push(j.id); enqueued.add(j.id); } };\r
  admit(0);\r
  while (completed < total) {\r
    if (queue.length === 0) { ticks[t] = null; t++; admit(t); continue; }\r
    const id = queue.shift()!;\r
    const run = Math.min(quantum, rem.get(id)!);\r
    for (let k = 0; k < run; k++) { ticks[t + k] = id; }\r
    t += run;\r
    rem.set(id, rem.get(id)! - run);\r
    completed += run;\r
    admit(t);                       // newcomers (incl. those arriving exactly at t) go in first…\r
    if (rem.get(id)! > 0) queue.push(id); // …then the preempted job rejoins the back\r
  }\r
  return finish(jobs, coalesce(ticks));\r
}\r
\r
export function schedule(jobs: Job[], policy: Policy, quantum = 2): Schedule {\r
  switch (policy) {\r
    case 'fcfs': return nonPreemptive(jobs, (j) => [j.arrival, 0, j.id]);\r
    case 'sjf': return nonPreemptive(jobs, (j) => [j.burst, j.arrival, j.id]);\r
    case 'srtf': return srtf(jobs);\r
    case 'rr': return roundRobin(jobs, quantum);\r
  }\r
}\r
\r
export const POLICY_LABEL: Record<Policy, string> = {\r
  fcfs: 'FCFS', sjf: 'SJF (non-preemptive)', srtf: 'SRTF (preemptive)', rr: 'Round-robin',\r
};\r
`;export{e as default};