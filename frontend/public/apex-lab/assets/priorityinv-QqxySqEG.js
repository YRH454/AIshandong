var e=`// Priority inversion — the bug that nearly killed the 1997 Mars Pathfinder mission. A HIGH-priority task needs\r
// a lock that a LOW-priority task is holding. Normally the high task just waits briefly for the low one to\r
// finish its critical section. But if a MEDIUM-priority task (that doesn't need the lock) wakes up, it\r
// preempts the low task — because medium > low — and now the low task can't run to release the lock, so the\r
// high task is stuck waiting on the medium task. Priorities are effectively INVERTED: medium work delays high\r
// work, without bound. On Pathfinder this triggered a watchdog reset loop until JPL enabled the fix remotely.\r
// The fix is PRIORITY INHERITANCE: while the high task is blocked on a lock, the lock's holder temporarily\r
// inherits the high priority, so medium tasks can't preempt it — the critical section finishes fast and the\r
// high task proceeds. This file simulates a fixed H/M/L scenario with and without inheritance.\r
// Reference: Sha, Rajkumar & Lehoczky (1990); the Mars Pathfinder post-mortem (Glenn Reeves, JPL).\r
\r
export interface Task { id: 'H' | 'M' | 'L'; prio: number; arrival: number; work: number; lockAt: number; unlockAt: number }\r
\r
// H needs the lock the instant it starts; L grabs it early and holds it a while; M needs no lock.\r
export const SCENARIO: Task[] = [\r
  { id: 'L', prio: 1, arrival: 0, work: 6, lockAt: 1, unlockAt: 5 },\r
  { id: 'H', prio: 3, arrival: 2, work: 4, lockAt: 0, unlockAt: 2 },\r
  { id: 'M', prio: 2, arrival: 3, work: 5, lockAt: -1, unlockAt: -1 },\r
];\r
\r
export interface SimResult {\r
  timeline: string[];                 // who ran at each time step ('H'/'M'/'L'/'idle')\r
  completion: Record<string, number>; // finish time per task\r
  hWait: number;                      // extra time H waited beyond its own work (the inversion cost)\r
}\r
\r
/** Run the fixed-priority preemptive scheduler over the scenario, with or without priority inheritance. */\r
export function simulate(tasks: Task[], inheritance: boolean, maxT = 60): SimResult {\r
  const st = tasks.map((t) => ({ ...t, executed: 0, holds: false, done: false, blocked: false }));\r
  const byId = (id: string) => st.find((s) => s.id === id)!;\r
  let lockHolder: string | null = null;\r
  const timeline: string[] = [];\r
  const completion: Record<string, number> = {};\r
\r
  // A lock holder inherits the highest priority among tasks currently blocked waiting for the lock.\r
  const effPrio = (s: (typeof st)[number]) => {\r
    if (inheritance && s.holds) {\r
      const waiters = st.filter((w) => w.blocked && !w.done);\r
      return waiters.length ? Math.max(s.prio, ...waiters.map((w) => w.prio)) : s.prio;\r
    }\r
    return s.prio;\r
  };\r
\r
  for (let t = 0; t < maxT; t++) {\r
    if (st.every((s) => s.done)) break;\r
    // Selection: pick the highest-effective-priority runnable task, blocking on the lock as needed.\r
    let ran: (typeof st)[number] | null = null;\r
    while (true) {\r
      const runnable = st.filter((s) => s.arrival <= t && !s.done && !s.blocked);\r
      if (!runnable.length) break;\r
      runnable.sort((a, b) => effPrio(b) - effPrio(a) || a.arrival - b.arrival);\r
      const cur = runnable[0];\r
      if (cur.lockAt >= 0 && cur.executed === cur.lockAt && !cur.holds) {\r
        if (lockHolder === null || lockHolder === cur.id) { lockHolder = cur.id; cur.holds = true; }\r
        else { cur.blocked = true; continue; } // can't get the lock → block, re-pick\r
      }\r
      ran = cur; break;\r
    }\r
    if (!ran) { timeline.push('idle'); continue; }\r
\r
    ran.executed++;\r
    timeline.push(ran.id);\r
    if (ran.holds && ran.executed === ran.unlockAt) { ran.holds = false; lockHolder = null; st.forEach((w) => { w.blocked = false; }); }\r
    if (ran.executed === ran.work) {\r
      ran.done = true; completion[ran.id] = t + 1;\r
      if (ran.holds) { ran.holds = false; lockHolder = null; st.forEach((w) => { w.blocked = false; }); }\r
    }\r
  }\r
\r
  const H = byId('H');\r
  const hWait = (completion['H'] ?? maxT) - H.arrival - H.work;\r
  return { timeline, completion, hWait };\r
}\r
`;export{e as default};