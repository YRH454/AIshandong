var e=`// Floyd's cycle detection — the "tortoise and hare," the trick for finding a loop in a sequence using O(1)\r
// memory. Follow a chain where each node points to exactly one next node (a linked list, or repeatedly applying\r
// a function x → f(x)). Eventually it either ends or loops forever. To detect a loop without remembering every\r
// node you've seen, run two pointers: the tortoise steps 1 at a time, the hare steps 2. If there's a loop the\r
// hare laps the tortoise and they land on the SAME node — a meeting that can only happen inside a cycle. Then a\r
// second, magical phase finds where the loop begins: reset one pointer to the start and advance both by 1;\r
// they meet exactly at the cycle's entrance (it falls out of the arithmetic: the distance from the start to the\r
// entrance equals the distance from the meeting point to the entrance, going around). It powers linked-list\r
// loop checks, detecting infinite iteration, and — as Pollard's rho — integer factorization and hash-collision\r
// finding. Reference: Floyd (via Knuth TAOCP vol. 2); Brent has a faster variant.\r
\r
export interface FloydResult {\r
  hasCycle: boolean;\r
  meetPoint: number;   // node where tortoise & hare first meet (−1 if no cycle)\r
  cycleStart: number;  // μ: the node where the loop begins (−1 if none)\r
  cycleLength: number; // λ: number of nodes in the loop (0 if none)\r
  tailLength: number;  // number of nodes before the loop\r
  path: number[];      // start → … → (one full loop) for visualization\r
}\r
\r
// One functional step; −1 means a terminal (no successor).\r
const step = (next: number[], x: number) => (x < 0 ? -1 : next[x]);\r
\r
export function floyd(next: number[], start: number): FloydResult {\r
  let slow = start, fast = start;\r
  do {\r
    slow = step(next, slow);\r
    fast = step(next, step(next, fast));\r
    if (slow < 0 || fast < 0) return { hasCycle: false, meetPoint: -1, cycleStart: -1, cycleLength: 0, tailLength: pathTo(next, start).length, path: pathTo(next, start) };\r
  } while (slow !== fast);\r
\r
  const meetPoint = slow;\r
  // Phase 2: distance(start → entrance) == distance(meet → entrance) around the loop.\r
  let a = start, b = meetPoint;\r
  while (a !== b) { a = step(next, a); b = step(next, b); }\r
  const cycleStart = a;\r
  // Phase 3: walk the loop once to measure it.\r
  let cycleLength = 1, c = step(next, cycleStart);\r
  while (c !== cycleStart) { c = step(next, c); cycleLength++; }\r
  // tail length: start → cycleStart\r
  let tailLength = 0, t = start;\r
  while (t !== cycleStart) { t = step(next, t); tailLength++; }\r
\r
  return { hasCycle: true, meetPoint, cycleStart, cycleLength, tailLength, path: buildPath(next, start, cycleStart, cycleLength) };\r
}\r
\r
function pathTo(next: number[], start: number): number[] {\r
  const out: number[] = []; let x = start;\r
  while (x >= 0 && out.length < 200) { out.push(x); x = next[x]; }\r
  return out;\r
}\r
function buildPath(next: number[], start: number, cycleStart: number, cycleLength: number): number[] {\r
  const out: number[] = []; let x = start;\r
  while (x !== cycleStart) { out.push(x); x = next[x]; } // tail\r
  for (let i = 0; i < cycleLength; i++) { out.push(x); x = next[x]; } // one loop\r
  return out;\r
}\r
\r
/** Ground truth: follow the chain remembering every node (O(n) memory) to find the loop. */\r
export function bruteForce(next: number[], start: number): { hasCycle: boolean; cycleStart: number; cycleLength: number } {\r
  const seen = new Map<number, number>();\r
  let x = start, i = 0;\r
  while (x >= 0) {\r
    if (seen.has(x)) return { hasCycle: true, cycleStart: x, cycleLength: i - seen.get(x)! };\r
    seen.set(x, i); x = next[x]; i++;\r
  }\r
  return { hasCycle: false, cycleStart: -1, cycleLength: 0 };\r
}\r
`;export{e as default};