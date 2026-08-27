var e=`// seccomp-BPF — how a process shrinks its own attack surface by allowlisting syscalls. After installing a filter, a\r
// process may only make the syscalls it declared; anything else hits the filter's DEFAULT ACTION — usually KILL the\r
// process (SCMP_ACT_KILL) or return EPERM (SCMP_ACT_ERRNO). It's how Docker, Chrome, and systemd (SystemCallFilter)\r
// keep a compromised process from doing damage: even with code execution, a blocked execve/ptrace/socket goes\r
// nowhere. Modelled: the per-syscall decision and what running a whole trace under a filter does.\r
\r
export type Action = 'allow' | 'errno' | 'kill';\r
export type Filter = { allow: string[]; def: Action }; // allowlist + default action for everything else\r
export type Syscall = { name: string; danger?: boolean }; // danger = an escape primitive (execve, ptrace, …)\r
export type Step = { name: string; action: Action; danger: boolean };\r
export type Outcome = {\r
  steps: Step[];\r
  killedAt: number | null;   // index where the process was killed, or null\r
  completed: boolean;        // reached the end of the trace without being killed\r
  escaped: boolean;          // a dangerous syscall was ALLOWED — the sandbox failed\r
};\r
\r
// One syscall's fate: allowed if on the list, otherwise the filter's default action.\r
export function decide(filter: Filter, name: string): Action {\r
  return filter.allow.includes(name) ? 'allow' : filter.def;\r
}\r
\r
// Run a whole trace under the filter. An 'errno' on a needed syscall lets the process keep running (it just gets an\r
// error back); a 'kill' terminates it there. A dangerous syscall that is ALLOWED means the sandbox was too loose and\r
// the exploit escaped.\r
export function run(filter: Filter, trace: Syscall[]): Outcome {\r
  const steps: Step[] = [];\r
  let killedAt: number | null = null;\r
  let escaped = false;\r
  for (let i = 0; i < trace.length; i++) {\r
    const sc = trace[i];\r
    const action = decide(filter, sc.name);\r
    steps.push({ name: sc.name, action, danger: !!sc.danger });\r
    if (action === 'allow' && sc.danger) escaped = true;\r
    if (action === 'kill') { killedAt = i; break; }\r
  }\r
  return { steps, killedAt, completed: killedAt === null, escaped };\r
}\r
\r
// The win condition for the sandbox puzzle: the program finishes its legitimate work (never killed before its last\r
// non-dangerous syscall) AND no dangerous syscall was allowed. \`lastLegitIndex\` is the last index that must run.\r
export function verdict(outcome: Outcome, lastLegitIndex: number): 'secure' | 'escaped' | 'broke-program' {\r
  if (outcome.escaped) return 'escaped';\r
  if (outcome.killedAt !== null && outcome.killedAt <= lastLegitIndex) return 'broke-program';\r
  return 'secure';\r
}\r
`;export{e as default};