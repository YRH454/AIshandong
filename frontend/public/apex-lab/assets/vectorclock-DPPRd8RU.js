var e=`// Vector clocks — how distributed systems reason about "what happened before what"\r
// when there is no shared clock. Each process keeps a vector (one counter per\r
// process). A local event bumps its own counter; a send bumps own then ships the\r
// vector; a receive merges the incoming vector (elementwise max) then bumps own.\r
// Comparing two vectors tells you the causal relation: one HAPPENED-BEFORE the\r
// other, or they are CONCURRENT (neither could have caused the other). Happened-\r
// before: Lamport 1978; the vector-clock construction itself: Fidge 1988 / Mattern\r
// 1988. Pure, deterministic model. Tested.\r
\r
export type Clock = Record<string, number>;\r
export type Relation = 'equal' | 'before' | 'after' | 'concurrent';\r
\r
export function emptyClock(procs: string[]): Clock {\r
  return Object.fromEntries(procs.map((p) => [p, 0]));\r
}\r
\r
/** A local (internal) event at process p: bump p's own counter. */\r
export function localEvent(c: Clock, p: string): Clock {\r
  return { ...c, [p]: (c[p] ?? 0) + 1 };\r
}\r
\r
/** Send from p: bump own, and the returned clock is also what's attached to the message. */\r
export function send(c: Clock, p: string): Clock {\r
  return localEvent(c, p);\r
}\r
\r
/** Receive at p of a message carrying \`msg\`: merge (elementwise max) then bump own. */\r
export function receive(c: Clock, msg: Clock, p: string): Clock {\r
  const keys = new Set([...Object.keys(c), ...Object.keys(msg)]);\r
  const merged: Clock = {};\r
  for (const k of keys) merged[k] = Math.max(c[k] ?? 0, msg[k] ?? 0);\r
  merged[p] = (merged[p] ?? 0) + 1;\r
  return merged;\r
}\r
\r
/** Causal relation between two vector clocks (the heart of it). */\r
export function compare(a: Clock, b: Clock): Relation {\r
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);\r
  let aLessSomewhere = false, bLessSomewhere = false;\r
  for (const k of keys) {\r
    const av = a[k] ?? 0, bv = b[k] ?? 0;\r
    if (av < bv) aLessSomewhere = true;\r
    if (av > bv) bLessSomewhere = true;\r
  }\r
  if (!aLessSomewhere && !bLessSomewhere) return 'equal';\r
  if (aLessSomewhere && !bLessSomewhere) return 'before'; // a happened-before b\r
  if (bLessSomewhere && !aLessSomewhere) return 'after';\r
  return 'concurrent'; // each is ahead in some entry → no causal order\r
}\r
\r
export function clockString(c: Clock, order: string[]): string {\r
  return '[' + order.map((p) => \`\${p}:\${c[p] ?? 0}\`).join(', ') + ']';\r
}\r
`;export{e as default};