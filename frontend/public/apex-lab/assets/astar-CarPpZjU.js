var e=`// A* pathfinding (Hart, Nilsson & Raphael, 1968) — find the shortest path on a grid while\r
// exploring far fewer cells than a blind search, by letting a HEURISTIC pull the frontier\r
// toward the goal. Each candidate cell is scored f = g + h: g is the known cost to reach it\r
// from the start, h is an estimate of the remaining cost to the goal (here Manhattan\r
// distance). A* always expands the lowest-f cell next, so it heads straight for the goal but\r
// detours around walls only as much as it must. Because the heuristic never overestimates\r
// (it's "admissible"), the path it finds is guaranteed optimal — the same as Dijkstra, but\r
// with the search focused. Pure; tested against BFS for optimality.\r
\r
export type Cell = [number, number];\r
const key = (x: number, y: number) => \`\${x},\${y}\`;\r
const manhattan = (a: Cell, b: Cell) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);\r
\r
export interface Grid { w: number; h: number; walls: Set<string> }\r
export interface Result { path: Cell[] | null; expanded: Cell[]; cost: number }\r
\r
function neighbors(g: Grid, [x, y]: Cell): Cell[] {\r
  const out: Cell[] = [];\r
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {\r
    const nx = x + dx, ny = y + dy;\r
    if (nx >= 0 && nx < g.w && ny >= 0 && ny < g.h && !g.walls.has(key(nx, ny))) out.push([nx, ny]);\r
  }\r
  return out;\r
}\r
\r
function reconstruct(came: Map<string, Cell>, goal: Cell): Cell[] {\r
  const path: Cell[] = [goal];\r
  let cur = goal;\r
  while (came.has(key(cur[0], cur[1]))) { cur = came.get(key(cur[0], cur[1]))!; path.push(cur); }\r
  return path.reverse();\r
}\r
\r
export function astar(g: Grid, start: Cell, goal: Cell): Result {\r
  const gScore = new Map<string, number>([[key(...start), 0]]);\r
  const came = new Map<string, Cell>();\r
  const open: Cell[] = [start];\r
  const expanded: Cell[] = [];\r
  const closed = new Set<string>();\r
\r
  while (open.length) {\r
    // pick the lowest f = g + h (tie-break by smaller h, then insertion order)\r
    let bi = 0;\r
    const f = (c: Cell) => (gScore.get(key(...c)) ?? Infinity) + manhattan(c, goal);\r
    for (let i = 1; i < open.length; i++) if (f(open[i]) < f(open[bi]) || (f(open[i]) === f(open[bi]) && manhattan(open[i], goal) < manhattan(open[bi], goal))) bi = i;\r
    const cur = open.splice(bi, 1)[0];\r
    const ck = key(...cur);\r
    if (closed.has(ck)) continue;\r
    closed.add(ck);\r
    expanded.push(cur);\r
    if (cur[0] === goal[0] && cur[1] === goal[1]) return { path: reconstruct(came, goal), expanded, cost: gScore.get(ck)! };\r
    for (const nb of neighbors(g, cur)) {\r
      const tentative = gScore.get(ck)! + 1;\r
      if (tentative < (gScore.get(key(...nb)) ?? Infinity)) { came.set(key(...nb), cur); gScore.set(key(...nb), tentative); open.push(nb); }\r
    }\r
  }\r
  return { path: null, expanded, cost: Infinity };\r
}\r
\r
/** Breadth-first search (no heuristic) — the optimality/expansion baseline. */\r
export function bfs(g: Grid, start: Cell, goal: Cell): Result {\r
  const came = new Map<string, Cell>();\r
  const seen = new Set<string>([key(...start)]);\r
  const queue: Cell[] = [start];\r
  const expanded: Cell[] = [];\r
  while (queue.length) {\r
    const cur = queue.shift()!;\r
    expanded.push(cur);\r
    if (cur[0] === goal[0] && cur[1] === goal[1]) { const path = reconstruct(came, goal); return { path, expanded, cost: path.length - 1 }; }\r
    for (const nb of neighbors(g, cur)) if (!seen.has(key(...nb))) { seen.add(key(...nb)); came.set(key(...nb), cur); queue.push(nb); }\r
  }\r
  return { path: null, expanded, cost: Infinity };\r
}\r
`;export{e as default};