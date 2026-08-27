var e=`// epoll & the C10k problem — how one thread can watch 10,000+ sockets at once. The old select()/poll()\r
// APIs make the kernel (and the app) walk the ENTIRE set of file descriptors on every wait, so cost grows\r
// O(n) with the number of connections even when only a handful are active — the wall that capped servers\r
// around 10k clients ("C10k"). epoll flips it: you register interest once, the kernel keeps a READY LIST,\r
// and epoll_wait returns only the fds that actually have events — O(active), independent of how many idle\r
// connections you hold. That's the engine under nginx, Node.js (libuv), Redis, and HAProxy. The other half\r
// of epoll is its sharpest edge: EDGE-triggered mode wakes you only on the transition to ready, so if you\r
// don't drain the socket fully you can deadlock waiting for an event that never repeats. References: Dan\r
// Kegel, "The C10K problem"; Linux epoll(7).\r
\r
export interface CompareResult {\r
  selectScans: number;   // total fd-slots the kernel/app must examine with select/poll\r
  epollScans: number;    // total work with epoll (only ready fds)\r
  ratio: number;         // how many times more work select does\r
  perCall: { select: number; epoll: number; ready: number }[];\r
}\r
\r
/** Compare select/poll vs epoll over a workload: \`total\` open connections, and for each epoll_wait call,\r
 *  how many of them are actually ready. select scans all \`total\` every call; epoll touches only the ready. */\r
export function compare(total: number, readyPerCall: number[]): CompareResult {\r
  const perCall = readyPerCall.map((ready) => ({ select: total, epoll: Math.max(1, ready), ready }));\r
  const selectScans = perCall.reduce((s, c) => s + c.select, 0);\r
  const epollScans = perCall.reduce((s, c) => s + c.epoll, 0);\r
  return { selectScans, epollScans, ratio: epollScans === 0 ? 0 : selectScans / epollScans, perCall };\r
}\r
\r
export interface DrainResult { mode: 'level' | 'edge'; wakeups: number; bytesRead: number; stalled: number }\r
\r
/** Level- vs edge-triggered draining. A socket holds \`available\` bytes; on each wakeup the app reads up to\r
 *  \`readPerWakeup\`. LEVEL-triggered keeps firing while data remains (you always drain it). EDGE-triggered\r
 *  fires once per arrival — if you don't loop until EAGAIN, the leftover bytes sit there with no further\r
 *  wakeup (a classic stall). Returns wakeups, bytes read, and bytes left stranded. */\r
export function drain(available: number, readPerWakeup: number, mode: 'level' | 'edge'): DrainResult {\r
  if (readPerWakeup <= 0) return { mode, wakeups: available > 0 ? 1 : 0, bytesRead: 0, stalled: available };\r
  if (mode === 'level') {\r
    const wakeups = Math.ceil(available / readPerWakeup) || 0;\r
    return { mode, wakeups, bytesRead: available, stalled: 0 };\r
  }\r
  // edge-triggered: exactly one wakeup for this arrival; a correct app loops, a naive one reads once\r
  const bytesRead = Math.min(available, readPerWakeup);\r
  return { mode, wakeups: available > 0 ? 1 : 0, bytesRead, stalled: available - bytesRead };\r
}\r
`;export{e as default};