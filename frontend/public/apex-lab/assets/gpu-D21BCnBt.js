var e=`// How a GPU runs code — SIMT, and the two ways it stalls. A GPU has thousands of tiny cores, but they aren't\r
// independent: they're wired into groups (a WARP on NVIDIA is 32 threads, a wavefront on AMD is 64) that share one\r
// instruction fetch and execute in LOCKSTEP. That's SIMT — Single Instruction, Multiple Threads: every thread in\r
// a warp runs the SAME instruction each cycle, just on its own data. This is why GPUs crush data-parallel work\r
// (add these million numbers) and stumble on branchy code. Two hazards follow directly from lockstep. (1) BRANCH\r
// DIVERGENCE: if an \`if\` sends some threads of a warp one way and the rest another, the hardware can't run both at\r
// once — it executes the taken path with the other threads masked OFF (idle), then the not-taken path with the\r
// first group masked off. The two sides are serialized, so a warp that splits down the middle does ~2x the work\r
// for the same result; the more branchy the code, the more idle lanes. (2) MEMORY COALESCING: the 32 threads\r
// issue their loads together, and if their addresses fall in one contiguous, aligned chunk the memory system\r
// fuses them into ONE wide transaction. If the addresses are scattered, it takes a separate transaction per line —\r
// each dragging in a full cache line to use just a few bytes — and bandwidth collapses. So the GPU golden rules\r
// are "keep a warp on one branch" and "make neighboring threads touch neighboring memory." This models warp\r
// divergence (passes + SIMT efficiency) and coalescing (transactions + bandwidth efficiency). Reference: NVIDIA\r
// CUDA C Programming Guide; Hennessy & Patterson, ch. 4 (data-level parallelism).\r
\r
export const WARP = 32;\r
\r
export interface Divergence { passes: number; efficiency: number; diverged: boolean; activePerPass: number[] }\r
\r
/** A warp hits a branch: \`pred[i]\` is whether thread i takes the \`if\`. Diverged branches serialize both paths. */\r
export function divergence(pred: boolean[]): Divergence {\r
  const takesIf = pred.filter((x) => x).length;\r
  const takesElse = pred.length - takesIf;\r
  const activePerPass: number[] = [];\r
  if (takesIf > 0) activePerPass.push(takesIf);\r
  if (takesElse > 0) activePerPass.push(takesElse);\r
  if (activePerPass.length === 0) activePerPass.push(0);\r
  const passes = activePerPass.length;\r
  // SIMT efficiency = useful lane-cycles / total lane-cycles issued (each pass occupies all WARP lanes)\r
  const efficiency = pred.length === 0 ? 1 : activePerPass.reduce((a, b) => a + b, 0) / (passes * pred.length);\r
  return { passes, efficiency, diverged: takesIf > 0 && takesElse > 0, activePerPass };\r
}\r
\r
export interface Coalesce { transactions: number; efficiency: number; bytesUsed: number; bytesFetched: number }\r
\r
/** The warp's threads load from \`addresses\`; the memory system fuses accesses that land in the same cache line. */\r
export function coalesce(addresses: number[], lineBytes = 128, elemBytes = 4): Coalesce {\r
  const lines = new Set(addresses.map((a) => Math.floor(a / lineBytes)));\r
  const transactions = lines.size;\r
  const bytesUsed = addresses.length * elemBytes;\r
  const bytesFetched = transactions * lineBytes;\r
  return { transactions, efficiency: bytesFetched === 0 ? 1 : Math.min(1, bytesUsed / bytesFetched), bytesUsed, bytesFetched };\r
}\r
\r
/** Common access patterns for a warp of \`n\` threads, as byte addresses. */\r
export const patterns = {\r
  contiguous: (n: number, elem = 4) => Array.from({ length: n }, (_, i) => i * elem),          // thread i → i (perfect)\r
  strided: (n: number, stride: number, elem = 4) => Array.from({ length: n }, (_, i) => i * stride * elem),\r
  scattered: (n: number, elem = 4) => Array.from({ length: n }, (_, i) => ((i * 2654435761) >>> 0) % (n * 128) * elem),\r
};\r
`;export{e as default};