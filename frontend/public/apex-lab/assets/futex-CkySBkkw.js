var e=`// futex — the "fast userspace mutex" that makes locking cheap. The trick: the lock word is an ordinary\r
// integer in shared userspace memory, and the COMMON case — lock an uncontended mutex, unlock one with no\r
// waiters — is a single atomic compare-and-swap with NO system call at all. Only when a thread actually has\r
// to BLOCK (the lock is held) or WAKE someone (it's releasing a lock others are waiting on) does it trap\r
// into the kernel via the futex syscall (FUTEX_WAIT / FUTEX_WAKE). So a mutex that's rarely contended costs\r
// almost nothing; you pay the kernel only for genuine contention. Every pthread mutex, Go's sync.Mutex, and\r
// Rust's std::sync::Mutex are built on this. State convention (Drepper, "Futexes Are Tricky"): 0 = free,\r
// 1 = locked / no waiters, 2 = locked / maybe waiters. Reference: futex(2); Drepper 2011.\r
\r
export interface Op { thread: string; kind: 'lock' | 'unlock' }\r
export interface Step {\r
  op: Op; state: number; owner: string | null;\r
  fastPath: boolean;            // resolved entirely in userspace?\r
  syscall: 'FUTEX_WAIT' | 'FUTEX_WAKE' | null;\r
  blocked: boolean;            // this lock attempt had to sleep\r
}\r
export interface FutexResult { steps: Step[]; syscalls: number; userOps: number; waiters: string[] }\r
\r
/** Run a sequence of lock/unlock ops on one futex-backed mutex, counting userspace atomics vs kernel calls.\r
 *  Uncontended lock/unlock are pure userspace (fastPath, no syscall); contention triggers FUTEX_WAIT, and\r
 *  releasing a lock with waiters triggers FUTEX_WAKE. */\r
export function run(ops: Op[]): FutexResult {\r
  let state = 0;                 // 0 free, 1 locked-no-waiters, 2 locked-maybe-waiters\r
  let owner: string | null = null;\r
  const waiters: string[] = [];\r
  const steps: Step[] = [];\r
  let syscalls = 0, userOps = 0;\r
\r
  for (const op of ops) {\r
    userOps++; // every op does at least one atomic compare/exchange in userspace\r
    let fastPath = false;\r
    let syscall: Step['syscall'] = null;\r
    let blocked = false;\r
\r
    if (op.kind === 'lock') {\r
      if (state === 0) {\r
        state = 1; owner = op.thread; fastPath = true;        // CAS 0→1, uncontended: no syscall\r
      } else {\r
        state = 2; waiters.push(op.thread);                   // mark contended and block\r
        syscall = 'FUTEX_WAIT'; syscalls++; blocked = true;\r
      }\r
    } else { // unlock (assumed by the current owner)\r
      if (waiters.length > 0) {\r
        const next = waiters.shift()!;                        // hand the lock to a waiter\r
        owner = next; state = waiters.length > 0 ? 2 : 1;\r
        syscall = 'FUTEX_WAKE'; syscalls++;\r
      } else {\r
        state = 0; owner = null; fastPath = true;             // CAS 1→0, no waiters: no syscall\r
      }\r
    }\r
    steps.push({ op, state, owner, fastPath, syscall, blocked });\r
  }\r
  return { steps, syscalls, userOps, waiters };\r
}\r
`;export{e as default};