var e=`// Consistency models — when many clients read and write one shared value, which results\r
// are "allowed"? We check two classic models on a single register by searching for a valid\r
// total order of the operations:\r
//   • Linearizable: a total order exists that (a) respects REAL TIME — if op A finished\r
//     before op B started, A precedes B — and (b) makes every read return the latest write.\r
//   • Sequential: a total order exists that respects each client's PROGRAM ORDER (not real\r
//     time) and makes every read return the latest write.\r
// Every linearizable history is sequential, but not vice-versa. Brute force over the small\r
// histories (≤7 ops) — exact, not heuristic. Tested against textbook examples.\r
\r
export interface Op { id: string; proc: number; kind: 'w' | 'r'; val: number; start: number; end: number; po: number }\r
\r
function* permutations<T>(arr: T[]): Generator<T[]> {\r
  if (arr.length <= 1) { yield arr; return; }\r
  for (let i = 0; i < arr.length; i++) {\r
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];\r
    for (const p of permutations(rest)) yield [arr[i], ...p];\r
  }\r
}\r
\r
/** Does this total order make every read return the most-recent write? (register init 0) */\r
function registerValid(order: Op[]): boolean {\r
  let cur = 0;\r
  for (const op of order) {\r
    if (op.kind === 'w') cur = op.val;\r
    else if (op.val !== cur) return false; // a read that didn't see the latest write\r
  }\r
  return true;\r
}\r
\r
function satisfies(ops: Op[], respectsRealTime: boolean): boolean {\r
  for (const order of permutations(ops)) {\r
    const pos = new Map(order.map((o, i) => [o.id, i]));\r
    let ok = true;\r
    for (const a of ops) {\r
      for (const b of ops) {\r
        if (a === b) continue;\r
        // real-time edge: a fully precedes b ⇒ a must come first\r
        if (respectsRealTime && a.end <= b.start && pos.get(a.id)! > pos.get(b.id)!) { ok = false; break; }\r
        // program-order edge: same client, earlier issue ⇒ must come first\r
        if (a.proc === b.proc && a.po < b.po && pos.get(a.id)! > pos.get(b.id)!) { ok = false; break; }\r
      }\r
      if (!ok) break;\r
    }\r
    if (ok && registerValid(order)) return true;\r
  }\r
  return false;\r
}\r
\r
export const isLinearizable = (ops: Op[]): boolean => satisfies(ops, true);\r
export const isSequential = (ops: Op[]): boolean => satisfies(ops, false);\r
\r
export interface Classification { linearizable: boolean; sequential: boolean; label: string }\r
\r
export function classify(ops: Op[]): Classification {\r
  const linearizable = isLinearizable(ops);\r
  const sequential = linearizable || isSequential(ops);\r
  return {\r
    linearizable, sequential,\r
    label: linearizable ? 'Linearizable' : sequential ? 'Sequential (not linearizable)' : 'Not sequentially consistent',\r
  };\r
}\r
`;export{e as default};