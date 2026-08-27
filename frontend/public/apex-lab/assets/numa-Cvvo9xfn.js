var e=`// NUMA — Non-Uniform Memory Access. On a multi-socket machine, RAM is split among nodes; a core reaches\r
// its OWN node's memory fast and another node's memory slower (the "NUMA factor", ~1.4–2×). The kicker is\r
// how the OS decides which node a page lives on: Linux's default is FIRST-TOUCH — a page is placed on the\r
// node of the core that first WRITES to it, not the core that allocated the address. So a program that\r
// mallocs a big array and initializes it from one thread pins ALL of it to one node; every other socket\r
// then pays remote latency forever. Initialize in parallel (each thread touches its own slice) and the\r
// data lands local to whoever uses it. This is the single biggest, most-missed NUMA optimization (it's\r
// why STREAM and OpenMP codes do a parallel "first-touch" init loop). Reference: Lameter, "NUMA (Non-\r
// Uniform Memory Access): An Overview", ACM Queue 2013; Linux numa(7), set_mempolicy(2).\r
\r
export const LOCAL_NS = 100;   // latency of a same-node memory access (illustrative)\r
export const REMOTE_NS = 160;  // latency across the interconnect — NUMA factor 1.6\r
\r
export interface Topology { cpuNode: number[] } // cpuNode[cpuId] -> node id\r
export interface Access { page: number; cpu: number }\r
export interface CostResult { local: number; remote: number; ns: number; avgNs: number }\r
\r
/** First-touch placement: page p lives on the node of the core that first touched it (touchedBy[p]). */\r
export function firstTouch(touchedBy: number[], topo: Topology): number[] {\r
  return touchedBy.map((cpu) => topo.cpuNode[cpu]);\r
}\r
\r
/** Interleave policy (\`numactl --interleave\`): round-robin pages across the nodes. Balanced, not optimal. */\r
export function interleave(nPages: number, nNodes: number): number[] {\r
  return Array.from({ length: nPages }, (_, p) => p % nNodes);\r
}\r
\r
/** Cost a stream of accesses given where each page lives. An access is local iff the accessing core's node\r
 *  equals the page's node; otherwise it crosses the interconnect. */\r
export function cost(placement: number[], accesses: Access[], topo: Topology): CostResult {\r
  let local = 0, remote = 0;\r
  for (const a of accesses) {\r
    if (topo.cpuNode[a.cpu] === placement[a.page]) local++;\r
    else remote++;\r
  }\r
  const ns = local * LOCAL_NS + remote * REMOTE_NS;\r
  const n = accesses.length;\r
  return { local, remote, ns, avgNs: n === 0 ? 0 : ns / n };\r
}\r
`;export{e as default};