var e=`// Classic 5-stage pipeline hazards — why a CPU can't just start one instruction every cycle, and how\r
// forwarding rescues most of the lost time. Stages: IF (fetch), ID (decode/read regs), EX (execute),\r
// MEM (memory), WB (write back). A data hazard happens when an instruction needs a register an earlier,\r
// still-in-flight instruction hasn't written yet. WITHOUT forwarding the reader must wait until the\r
// writer's WB (≈3 bubbles). WITH forwarding the EX result is bypassed straight to the next EX, erasing\r
// the stall — EXCEPT the load-use hazard: a load's value isn't ready until after MEM, so an instruction\r
// that uses it on the very next cycle still eats exactly one bubble. We compute each stage's cycle for\r
// an in-order single-issue pipeline, exactly. Reference: Patterson & Hennessy, Computer Organization ch.4.\r
\r
export interface Instr { text: string; dest: string | null; srcs: string[]; isLoad: boolean }\r
export interface Timing { instr: Instr; if: number; id: number; ex: number; mem: number; wb: number; stalledBy: number | null }\r
export interface PipelineResult { rows: Timing[]; cycles: number; idealCycles: number; stalls: number; cpi: number }\r
\r
/** Cycle-accurate schedule of an in-order, single-issue 5-stage pipeline. Cycles are 1-indexed: the\r
 *  first instruction does IF in cycle 1, EX in cycle 3. With forwarding, ALU→ALU costs nothing and a\r
 *  load→use costs one bubble; without it, every RAW dependency waits for the producer's WB. */\r
export function simulate(instrs: Instr[], forwarding: boolean): PipelineResult {\r
  const n = instrs.length;\r
  const ex: number[] = [];\r
  const stalledBy: (number | null)[] = [];\r
\r
  for (let i = 0; i < n; i++) {\r
    let e = i + 3;                              // earliest EX given in-order fetch (instr i fetched cycle i+1)\r
    if (i > 0) e = Math.max(e, ex[i - 1] + 1);  // one EX slot per cycle, in program order\r
    let cause: number | null = null;\r
    for (const s of instrs[i].srcs) {\r
      // most recent earlier writer of this register\r
      let j = -1;\r
      for (let k = i - 1; k >= 0; k--) if (instrs[k].dest === s) { j = k; break; }\r
      if (j < 0) continue;\r
      const need = forwarding ? (instrs[j].isLoad ? ex[j] + 2 : ex[j] + 1) : ex[j] + 3;\r
      if (need > e) { e = need; cause = j; }\r
    }\r
    // a stall exists only if this instruction was pushed later than back-to-back issue would allow\r
    stalledBy[i] = i > 0 && e > ex[i - 1] + 1 ? cause : null;\r
    ex[i] = e;\r
  }\r
\r
  const rows: Timing[] = instrs.map((instr, i) => ({\r
    instr, if: ex[i] - 2, id: ex[i] - 1, ex: ex[i], mem: ex[i] + 1, wb: ex[i] + 2, stalledBy: stalledBy[i],\r
  }));\r
  const cycles = n ? ex[n - 1] + 2 : 0;\r
  const idealCycles = n ? n + 4 : 0;\r
  return { rows, cycles, idealCycles, stalls: cycles - idealCycles, cpi: n ? cycles / n : 0 };\r
}\r
\r
/** Tiny parser: "lw r1, 0(r2)" / "add r3, r1, r2" → an Instr (regs are r-tokens; first is dest). */\r
export function parse(line: string): Instr {\r
  const op = line.trim().split(/\\s+/)[0].toLowerCase();\r
  const regs = line.match(/r\\d+/g) ?? [];\r
  const isLoad = op === 'lw' || op === 'ld' || op === 'load';\r
  const isStore = op === 'sw' || op === 'st' || op === 'store';\r
  // store writes no register; its regs are all sources. otherwise first reg is the destination.\r
  if (isStore) return { text: line.trim(), dest: null, srcs: regs, isLoad: false };\r
  return { text: line.trim(), dest: regs[0] ?? null, srcs: regs.slice(1), isLoad };\r
}\r
\r
export const parseProgram = (src: string): Instr[] => src.split('\\n').map((l) => l.trim()).filter(Boolean).map(parse);\r
`;export{e as default};