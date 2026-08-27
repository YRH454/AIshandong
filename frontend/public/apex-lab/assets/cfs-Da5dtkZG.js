var e=`// Linux CFS (the Completely Fair Scheduler) — how Linux shared the CPU for ~15 years (until EEVDF in\r
// 6.6). The idea: track each task's "virtual runtime" (vruntime) and always run the one that has had the\r
// LEAST, so over time everyone converges to a fair share. Fairness is weighted by nice value: vruntime\r
// advances as real_time × (NICE_0_WEIGHT / weight), so a low-weight (niced-down) task's clock runs FAST\r
// and it earns proportionally less CPU. CFS keeps tasks in a red-black tree keyed by vruntime and runs\r
// the leftmost (smallest) one. Result: long-run CPU share ∝ weight. The weight table is the kernel's\r
// sched_prio_to_weight[] (nice 0 = 1024, ~1.25× per level). Reference: kernel/sched/fair.c; OSTEP ch.9.\r
\r
export const NICE_0_WEIGHT = 1024;\r
// Exact kernel sched_prio_to_weight[] values for nice −5..+5 (each step ≈ 1.25×).\r
export const WEIGHT: Record<number, number> = {\r
  [-5]: 3121, [-4]: 2501, [-3]: 1991, [-2]: 1586, [-1]: 1277,\r
  [0]: 1024, [1]: 820, [2]: 655, [3]: 526, [4]: 423, [5]: 335,\r
};\r
export const weightOf = (nice: number) => WEIGHT[Math.max(-5, Math.min(5, nice))] ?? NICE_0_WEIGHT;\r
\r
export interface Task { id: string; nice: number }\r
export interface CfsState { vruntime: Record<string, number>; cpu: Record<string, number> }\r
export interface Pick { id: string; ranFor: number; vrAfter: number; minVruntime: number }\r
\r
export const initCfs = (tasks: Task[]): CfsState => ({\r
  vruntime: Object.fromEntries(tasks.map((t) => [t.id, 0])),\r
  cpu: Object.fromEntries(tasks.map((t) => [t.id, 0])),\r
});\r
\r
/** The task CFS runs next: the leftmost in the RB-tree = smallest vruntime (ties → lexicographic id). */\r
export function leftmost(tasks: Task[], st: CfsState): string {\r
  return [...tasks].sort((a, b) => st.vruntime[a.id] - st.vruntime[b.id] || (a.id < b.id ? -1 : 1))[0].id;\r
}\r
\r
/** Run the scheduler for one timeslice: pick the min-vruntime task, give it \`slice\` ms, advance its\r
 *  vruntime by slice × NICE_0_WEIGHT/weight (so heavy tasks' clocks tick slower → more real CPU). */\r
export function tick(tasks: Task[], st: CfsState, slice: number): { state: CfsState; pick: Pick } {\r
  const id = leftmost(tasks, st);\r
  const nice = tasks.find((t) => t.id === id)!.nice;\r
  const vr = st.vruntime[id] + slice * (NICE_0_WEIGHT / weightOf(nice));\r
  const next: CfsState = {\r
    vruntime: { ...st.vruntime, [id]: vr },\r
    cpu: { ...st.cpu, [id]: st.cpu[id] + slice },\r
  };\r
  const minV = Math.min(...tasks.map((t) => next.vruntime[t.id]));\r
  return { state: next, pick: { id, ranFor: slice, vrAfter: vr, minVruntime: minV } };\r
}\r
\r
/** Run \`n\` timeslices and report each task's achieved CPU share vs the weight-proportional ideal. */\r
export function run(tasks: Task[], slice: number, n: number): { state: CfsState; picks: Pick[]; share: Record<string, number>; ideal: Record<string, number> } {\r
  let st = initCfs(tasks);\r
  const picks: Pick[] = [];\r
  for (let i = 0; i < n; i++) { const r = tick(tasks, st, slice); st = r.state; picks.push(r.pick); }\r
  const totalCpu = tasks.reduce((a, t) => a + st.cpu[t.id], 0) || 1;\r
  const totalW = tasks.reduce((a, t) => a + weightOf(t.nice), 0);\r
  const share = Object.fromEntries(tasks.map((t) => [t.id, st.cpu[t.id] / totalCpu]));\r
  const ideal = Object.fromEntries(tasks.map((t) => [t.id, weightOf(t.nice) / totalW]));\r
  return { state: st, picks, share, ideal };\r
}\r
`;export{e as default};