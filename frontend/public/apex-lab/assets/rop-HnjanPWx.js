var e=`// Return-oriented programming, as a producible puzzle. NX makes the stack non-executable, so injected shellcode\r
// won't run — but you still control the stack, and \`ret\` blindly jumps to whatever address it pops. So you REUSE\r
// code that is already executable: short instruction sequences ending in \`ret\` ("gadgets") scattered through the\r
// binary and libc. Chain their addresses up the stack and each gadget's \`ret\` runs the next.\r
//\r
// This models the chain on a tiny register machine. Each \`pop rX ; ret\` gadget loads the next stack word into a\r
// register; \`syscall ; ret\` invokes the Linux x86-64 syscall whose number is in rax, with arguments in rdi, rsi,\r
// rdx. The goal is execve("/bin/sh", NULL, NULL) — the canonical "pop a shell": syscall 59, rdi = &"/bin/sh",\r
// rsi = 0, rdx = 0. The syscall ABI here is the real Linux x86-64 convention; the gadget addresses are illustrative.\r
\r
export type Reg = 'rdi' | 'rsi' | 'rdx' | 'rax' | 'rbx';\r
export type Gadget = { id: string; asm: string; addr: string; pops: Reg | null; syscall?: boolean; decoy?: boolean };\r
\r
// execve on x86-64 Linux: syscall number 59, args in rdi (pathname), rsi (argv), rdx (envp).\r
export const EXECVE = 59;\r
export const BINSH = '0x7ffff7f8e2d0'; // illustrative address of a "/bin/sh" string already in libc\r
\r
export const GADGETS: Gadget[] = [\r
  { id: 'rdi', asm: 'pop rdi ; ret', addr: '0x401173', pops: 'rdi' },\r
  { id: 'rsi', asm: 'pop rsi ; ret', addr: '0x4011a8', pops: 'rsi' },\r
  { id: 'rdx', asm: 'pop rdx ; ret', addr: '0x4011c5', pops: 'rdx' },\r
  { id: 'rax', asm: 'pop rax ; ret', addr: '0x401192', pops: 'rax' },\r
  { id: 'syscall', asm: 'syscall ; ret', addr: '0x40118f', pops: null, syscall: true },\r
  { id: 'rbx', asm: 'pop rbx ; ret', addr: '0x401201', pops: 'rbx', decoy: true }, // rbx is not a syscall argument\r
];\r
\r
export type Word = { label: string; val: number | string };\r
export const WORDS: Word[] = [\r
  { label: '0  (NULL)', val: 0 },\r
  { label: '&"/bin/sh"', val: BINSH },\r
  { label: '59  (execve)', val: EXECVE },\r
  { label: '60  (exit)', val: 60 },\r
];\r
\r
export type ChainEntry = { gadget: Gadget; word?: Word };\r
export type Regs = Record<Reg, number | string>;\r
const EMPTY: Regs = { rdi: '—', rsi: '—', rdx: '—', rax: '—', rbx: '—' };\r
\r
export type StepTrace = { entryIdx: number; note: string; regs: Regs };\r
export type RunResult = { regs: Regs; shell: boolean; reason: string; trace: StepTrace[]; syscallReached: boolean };\r
\r
// Execute the chain: walk it in order, each gadget applying its effect, until a syscall resolves it.\r
export function runChain(chain: ChainEntry[]): RunResult {\r
  const regs: Regs = { ...EMPTY };\r
  const trace: StepTrace[] = [];\r
  for (let i = 0; i < chain.length; i++) {\r
    const { gadget, word } = chain[i];\r
    if (gadget.pops) {\r
      regs[gadget.pops] = word ? word.val : 0;\r
      trace.push({ entryIdx: i, note: \`\${gadget.asm}  →  \${gadget.pops} = \${word ? word.label.trim() : '0'}\`, regs: { ...regs } });\r
    } else if (gadget.syscall) {\r
      const ok = regs.rax === EXECVE && regs.rdi === BINSH && regs.rsi === 0 && regs.rdx === 0;\r
      trace.push({ entryIdx: i, note: \`syscall  →  execve(rdi, rsi, rdx) with rax=\${regs.rax === '—' ? 'unset' : regs.rax}\`, regs: { ...regs } });\r
      return {\r
        regs, trace, syscallReached: true, shell: ok,\r
        reason: ok\r
          ? 'execve("/bin/sh", NULL, NULL) runs — a shell spawns. Every instruction executed was already in an executable page, so NX never fired and not one injected byte ran.'\r
          : whyNoShell(regs),\r
      };\r
    }\r
  }\r
  return { regs, trace, syscallReached: false, shell: false, reason: 'The chain never reaches a syscall — nothing gets invoked. Add a “syscall ; ret” gadget at the end.' };\r
}\r
\r
function whyNoShell(r: Regs): string {\r
  if (r.rax !== EXECVE) {\r
    if (r.rax === 60) return 'syscall ran with rax=60 — that is exit(), so the process just dies. You need rax=59 (execve).';\r
    return \`syscall ran, but rax=\${r.rax === '—' ? 'unset' : r.rax}, not 59 — that is not execve, so no shell.\`;\r
  }\r
  if (r.rdi !== BINSH) return 'rax=59 (execve), but rdi is not the "/bin/sh" pointer — execve has no program path to run.';\r
  if (r.rsi !== 0) return 'rax=59 and rdi is set, but execve needs rsi = 0 (NULL argv). It is not.';\r
  if (r.rdx !== 0) return 'almost — rax, rdi, rsi are right, but execve needs rdx = 0 (NULL envp).';\r
  return 'registers are not fully set up for execve.';\r
}\r
`;export{e as default};