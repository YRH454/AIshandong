var e=`// Memory consistency & store buffers — why two threads can BOTH read the old value, and how a fence\r
// forbids it. The store-buffer litmus test (Dekker's core): x=y=0, then\r
//     Core 0:  x = 1;  r0 = y          Core 1:  y = 1;  r1 = x\r
// Under Sequential Consistency the outcome r0=r1=0 is IMPOSSIBLE — some total order of the four\r
// operations must put a store before the other core's load. Real x86 hardware allows it: each core\r
// buffers its store in a private FIFO and reads the other variable from memory before the buffer\r
// drains, so both loads see 0. An MFENCE drains the buffer before the load, forbidding it again.\r
// We enumerate the ENTIRE reachable state space, so the allowed/forbidden outcomes are exact, not\r
// sampled. Reference: Sewell et al., "x86-TSO: A Rigorous and Usable Programmer's Model" (CACM 2010).\r
\r
export type Instr =\r
  | { op: 'store'; var: string; val: number }\r
  | { op: 'load'; var: string; reg: string }\r
  | { op: 'fence' };\r
export type Model = 'SC' | 'TSO';\r
\r
interface State { pc: number[]; buf: { var: string; val: number }[][]; mem: Record<string, number>; reg: Record<string, number> }\r
\r
const ser = (s: State) =>\r
  JSON.stringify([s.pc, s.buf, Object.entries(s.mem).sort(), Object.entries(s.reg).sort()]);\r
const cloneState = (s: State): State => ({ pc: [...s.pc], buf: s.buf.map((b) => b.map((e) => ({ ...e }))), mem: { ...s.mem }, reg: { ...s.reg } });\r
\r
/** Enumerate every reachable final assignment of \`resultRegs\` over all interleavings (and, under TSO,\r
 *  all store-buffer drain orders). Returns the distinct outcomes as comma-joined "name=value" rows. */\r
export function outcomes(programs: Instr[][], model: Model, resultRegs: string[]): string[] {\r
  const vars = new Set<string>();\r
  for (const p of programs) for (const i of p) if (i.op !== 'fence') vars.add(i.var);\r
  const mem0: Record<string, number> = {}; for (const v of vars) mem0[v] = 0;\r
\r
  const init: State = { pc: programs.map(() => 0), buf: programs.map(() => []), mem: mem0, reg: {} };\r
  const results = new Set<string>();\r
  const visited = new Set<string>();\r
\r
  const fmt = (s: State) => resultRegs.map((r) => \`\${r}=\${s.reg[r] ?? 0}\`).join(', ');\r
\r
  const dfs = (s: State) => {\r
    const key = ser(s);\r
    if (visited.has(key)) return;\r
    visited.add(key);\r
\r
    const done = s.pc.every((pc, i) => pc >= programs[i].length);\r
    const drained = s.buf.every((b) => b.length === 0);\r
    if (done && drained) { results.add(fmt(s)); return; }\r
\r
    for (let i = 0; i < programs.length; i++) {\r
      // (a) execute core i's next instruction\r
      if (s.pc[i] < programs[i].length) {\r
        const instr = programs[i][s.pc[i]];\r
        if (instr.op === 'store') {\r
          const n = cloneState(s);\r
          if (model === 'SC') n.mem[instr.var] = instr.val; else n.buf[i].push({ var: instr.var, val: instr.val });\r
          n.pc[i]++; dfs(n);\r
        } else if (instr.op === 'load') {\r
          const n = cloneState(s);\r
          let v = n.mem[instr.var] ?? 0;\r
          if (model === 'TSO') { // store-to-load forwarding: own buffer shadows memory\r
            for (let k = n.buf[i].length - 1; k >= 0; k--) if (n.buf[i][k].var === instr.var) { v = n.buf[i][k].val; break; }\r
          }\r
          n.reg[instr.reg] = v; n.pc[i]++; dfs(n);\r
        } else { // fence: under TSO it may proceed only once this core's buffer is empty\r
          if (model === 'SC' || s.buf[i].length === 0) { const n = cloneState(s); n.pc[i]++; dfs(n); }\r
        }\r
      }\r
      // (b) under TSO, drain the front of core i's store buffer to memory at any time\r
      if (model === 'TSO' && s.buf[i].length > 0) {\r
        const n = cloneState(s);\r
        const e = n.buf[i].shift()!;\r
        n.mem[e.var] = e.val;\r
        dfs(n);\r
      }\r
    }\r
  };\r
\r
  dfs(init);\r
  return [...results].sort();\r
}\r
\r
/** The store-buffer (Dekker) litmus test, optionally with a fence before each load. */\r
export function sbTest(fenced: boolean): Instr[][] {\r
  const fence: Instr[] = fenced ? [{ op: 'fence' }] : [];\r
  return [\r
    [{ op: 'store', var: 'x', val: 1 }, ...fence, { op: 'load', var: 'y', reg: 'r0' }],\r
    [{ op: 'store', var: 'y', val: 1 }, ...fence, { op: 'load', var: 'x', reg: 'r1' }],\r
  ];\r
}\r
\r
/** Did the weak outcome r0=r1=0 (both loads see the stale value) survive? */\r
export const allowsBothZero = (rows: string[]) => rows.includes('r0=0, r1=0');\r
`;export{e as default};