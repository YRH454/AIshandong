var e=`// Out-of-order execution — why a modern CPU runs your instructions in a different order than you wrote them, and\r
// still gets the right answer. A simple in-order core issues instructions strictly in program order: when one\r
// stalls (say a load that misses cache and takes 100+ cycles), everything behind it stalls too, even instructions\r
// that don't depend on it. That wastes the CPU's many execution units. An OUT-OF-ORDER core instead tracks data\r
// dependencies and issues each instruction the moment its inputs are ready, regardless of program order, so\r
// independent work runs during the stall. The catch is false dependencies: if a later instruction reuses a\r
// register name an earlier one wrote (write-after-write) or read (write-after-read), naively reordering would\r
// corrupt it. REGISTER RENAMING fixes this — every write gets a fresh physical register, so the only orderings\r
// the hardware must respect are TRUE (read-after-write) data dependencies. With those and only those, the OoO\r
// completion time is the dataflow CRITICAL PATH, while the in-order time is dragged out by program-order\r
// stalling. Results are still committed (retired) in program order, via a reorder buffer, so the programmer sees\r
// a clean sequential machine even though execution scrambled underneath. This models both schedules from the true\r
// dependency graph and the speedup. Reference: Tomasulo (1967); Hennessy & Patterson, ch. 3 (ILP).\r
\r
export interface Insn { text: string; dest: string; srcs: string[]; latency: number }\r
export interface Schedule { issue: number[]; finish: number[]; cycles: number }\r
\r
/** For each instruction, the indices of the most-recent prior writer of each source register (true RAW deps). */\r
export function rawDeps(insns: Insn[]): number[][] {\r
  const lastWriter = new Map<string, number>();\r
  return insns.map((ins, i) => {\r
    const deps: number[] = [];\r
    for (const s of ins.srcs) { const p = lastWriter.get(s); if (p !== undefined) deps.push(p); }\r
    const unique = [...new Set(deps)];\r
    if (ins.dest) lastWriter.set(ins.dest, i); // set AFTER reading srcs, so RAW points at the prior writer\r
    return unique;\r
  });\r
}\r
\r
/** Schedule the program. Out-of-order respects only RAW deps (renaming removes false deps); in-order also forces\r
 *  each instruction to issue no earlier than the previous one (program order). Unlimited issue width. */\r
export function schedule(insns: Insn[], inOrder: boolean): Schedule {\r
  const raw = rawDeps(insns);\r
  const issue = new Array(insns.length).fill(0);\r
  const finish = new Array(insns.length).fill(0);\r
  for (let i = 0; i < insns.length; i++) {\r
    let ready = 0;\r
    for (const p of raw[i]) ready = Math.max(ready, finish[p]);   // wait for producers' results\r
    if (inOrder && i > 0) ready = Math.max(ready, issue[i - 1]);  // program-order issue constraint\r
    issue[i] = ready;\r
    finish[i] = ready + insns[i].latency;\r
  }\r
  return { issue, finish, cycles: insns.length ? Math.max(...finish) : 0 };\r
}\r
\r
/** Parse "r1 = load r0" / "r2 = r1 + r1" into an Insn (latency: load=4, everything else=1). */\r
export function parse(text: string): Insn {\r
  const m = text.match(/^\\s*(\\w+)\\s*=\\s*(.*)$/);\r
  if (!m) return { text, dest: '', srcs: [], latency: 1 };\r
  const dest = m[1];\r
  const rhs = m[2];\r
  const srcs = [...rhs.matchAll(/\\b(r\\d+)\\b/g)].map((x) => x[1]);\r
  const latency = /\\bload\\b/.test(rhs) ? 4 : 1;\r
  return { text, dest, srcs, latency };\r
}\r
`;export{e as default};