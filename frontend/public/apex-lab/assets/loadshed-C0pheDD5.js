var e=`// Load shedding & backpressure — why, under overload, the right move is to REJECT work fast rather than\r
// queue it. A server processes at a fixed rate; when demand exceeds it, requests pile up. With an\r
// UNBOUNDED queue the wait grows without limit, so by the time a request reaches the front the client\r
// has already given up — the server burns 100% of its capacity serving responses nobody is waiting for\r
// (congestion collapse: offered load up, useful throughput → 0). The fix is a BOUNDED queue plus\r
// admission control: once the queue is full, shed the excess immediately (a fast 503 the client can\r
// retry elsewhere), which keeps the wait — and thus the latency of ACCEPTED requests — bounded, so they\r
// finish within their deadline. That fast rejection IS backpressure: it tells upstream to slow down.\r
// Reference: Google SRE "Handling Overload"; Little's law (wait = queue / rate).\r
\r
export interface Tick { t: number; queueLen: number; goodput: number; wasted: number; shed: number; latency: number }\r
export interface ShedResult { ticks: Tick[]; goodput: number; wasted: number; shed: number; maxQueue: number; finalQueue: number }\r
\r
/** Simulate FIFO service against an offered-load series. \`deadline\` is how long a client waits before\r
 *  giving up; a request served after that is "wasted" (served too late). mode 'shed' caps the queue at\r
 *  \`capacity\`; mode 'unbounded' queues everything. */\r
export function simulate(load: number[], capacity: number, rate: number, deadline: number, mode: 'shed' | 'unbounded'): ShedResult {\r
  let queue: number[] = []; // arrival ticks, FIFO\r
  let goodput = 0, wasted = 0, shed = 0, maxQueue = 0;\r
  const ticks: Tick[] = [];\r
  for (let t = 0; t < load.length; t++) {\r
    // serve up to \`rate\` from the front\r
    for (let s = 0; s < rate && queue.length; s++) {\r
      const arr = queue.shift()!;\r
      if (t - arr <= deadline) goodput++; else wasted++;\r
    }\r
    // admit this tick's arrivals\r
    const a = load[t];\r
    if (mode === 'shed') {\r
      const room = Math.max(0, capacity - queue.length);\r
      const admitted = Math.min(a, room);\r
      shed += a - admitted;\r
      for (let i = 0; i < admitted; i++) queue.push(t);\r
    } else {\r
      for (let i = 0; i < a; i++) queue.push(t);\r
    }\r
    maxQueue = Math.max(maxQueue, queue.length);\r
    ticks.push({ t, queueLen: queue.length, goodput, wasted, shed, latency: queue.length / rate });\r
  }\r
  return { ticks, goodput, wasted, shed, maxQueue, finalQueue: queue.length };\r
}\r
`;export{e as default};