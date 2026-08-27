var e=`// io_uring — Linux's modern async I/O, and why it leaves epoll (and plain read/write) behind on syscall\r
// cost. Classic blocking I/O is one syscall PER operation. epoll improves *readiness* notification but you\r
// still issue a read/write syscall for every ready fd — it tells you WHEN, not does the I/O for you.\r
// io_uring sets up two shared ring buffers in memory the app and kernel both see: the SUBMISSION queue (SQ,\r
// app→kernel) and the COMPLETION queue (CQ, kernel→app). You fill the SQ with many requests and submit them\r
// all with ONE io_uring_enter syscall; the kernel performs the I/O asynchronously and posts results to the\r
// CQ, which you reap with NO syscall at all. With SQPOLL, a kernel thread polls the SQ so even enter() goes\r
// away — zero syscalls on the hot path. That's how io_uring drives millions of IOPS from one thread.\r
// Reference: Jens Axboe, "Efficient IO with io_uring" (2019); io_uring(7).\r
\r
export type Mode = 'blocking' | 'epoll' | 'iouring' | 'iouring-sqpoll';\r
\r
/** Syscalls needed to perform \`ops\` I/O operations under each model, given an io_uring batch / epoll ready\r
 *  batch size. blocking = 1 syscall per op; epoll = a read per op PLUS a wait per batch of ready fds;\r
 *  io_uring = one io_uring_enter per submitted batch (completions reaped from the CQ with no syscall);\r
 *  io_uring+SQPOLL = 0 (a kernel thread consumes the SQ). */\r
export function syscalls(mode: Mode, ops: number, batch: number): number {\r
  const b = Math.max(1, batch);\r
  switch (mode) {\r
    case 'blocking': return ops;\r
    case 'epoll': return ops + Math.ceil(ops / b);\r
    case 'iouring': return Math.ceil(ops / b);\r
    case 'iouring-sqpoll': return 0;\r
  }\r
}\r
\r
export function compareAll(ops: number, batch: number): Record<Mode, number> {\r
  return {\r
    blocking: syscalls('blocking', ops, batch),\r
    epoll: syscalls('epoll', ops, batch),\r
    iouring: syscalls('iouring', ops, batch),\r
    'iouring-sqpoll': syscalls('iouring-sqpoll', ops, batch),\r
  };\r
}\r
\r
export interface RingState { sq: number[]; cq: number[]; inKernel: number[]; submitted: number; reaped: number }\r
\r
/** One round of the io_uring loop: the app has queued \`sq\` requests; io_uring_enter submits up to \`batch\` of\r
 *  them (they move to the kernel), and any in-kernel requests that have finished post to the CQ. A tiny\r
 *  deterministic model for the visualization — kernel completes everything submitted in the prior round. */\r
export function ringRound(state: RingState, batch: number): RingState {\r
  const completed = state.inKernel;                 // last round's submissions are now done\r
  const toSubmit = state.sq.slice(0, batch);        // submit a batch from the SQ\r
  const remaining = state.sq.slice(batch);\r
  return {\r
    sq: remaining,\r
    inKernel: toSubmit,\r
    cq: [...state.cq, ...completed],\r
    submitted: state.submitted + toSubmit.length,\r
    reaped: state.reaped + completed.length,\r
  };\r
}\r
`;export{e as default};