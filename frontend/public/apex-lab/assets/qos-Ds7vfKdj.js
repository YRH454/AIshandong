var e=`// QoS packet scheduling — when many traffic classes share one output link, which\r
// packet goes next? Two classic disciplines, with very different fairness:\r
//   STRICT PRIORITY  — always serve the highest-priority non-empty class first.\r
//                      Latency-perfect for the top class, but a busy high class can\r
//                      STARVE the low ones (bulk never leaves while VoIP keeps coming).\r
//   WEIGHTED ROUND ROBIN — give each class a share of the link proportional to its\r
//                      weight, cycling so nobody starves (the basis of WFQ/DRR).\r
// We dequeue a fixed number of "slots" and record the output order + per-class share.\r
// Pure, deterministic model. Tested.\r
\r
export interface TClass {\r
  id: string;\r
  priority: number; // lower number = higher priority (for strict priority)\r
  weight: number; // for weighted round robin (slots per round)\r
  queue: number; // packets waiting\r
}\r
export type Discipline = 'priority' | 'wrr';\r
\r
export interface ScheduleResult {\r
  order: string[]; // the class id served at each output slot\r
  share: Record<string, number>; // packets sent per class\r
  starved: string[]; // classes that had packets but sent none\r
}\r
\r
/** Schedule \`slots\` output opportunities over the classes under \`discipline\`. */\r
export function schedule(classes: TClass[], discipline: Discipline, slots: number): ScheduleResult {\r
  const q: Record<string, number> = {};\r
  for (const c of classes) q[c.id] = c.queue;\r
  const order: string[] = [];\r
  const share: Record<string, number> = Object.fromEntries(classes.map((c) => [c.id, 0]));\r
\r
  if (discipline === 'priority') {\r
    const byPrio = [...classes].sort((a, b) => a.priority - b.priority);\r
    for (let s = 0; s < slots; s++) {\r
      const c = byPrio.find((x) => q[x.id] > 0);\r
      if (!c) break; // nothing to send\r
      q[c.id]--; share[c.id]++; order.push(c.id);\r
    }\r
  } else {\r
    // weighted round robin: each round, serve up to \`weight\` packets per class\r
    let sent = 0;\r
    let progress = true;\r
    while (sent < slots && progress) {\r
      progress = false;\r
      for (const c of classes) {\r
        for (let w = 0; w < c.weight && sent < slots; w++) {\r
          if (q[c.id] > 0) { q[c.id]--; share[c.id]++; order.push(c.id); sent++; progress = true; }\r
        }\r
      }\r
    }\r
  }\r
\r
  const starved = classes.filter((c) => c.queue > 0 && share[c.id] === 0).map((c) => c.id);\r
  return { order, share, starved };\r
}\r
`;export{e as default};