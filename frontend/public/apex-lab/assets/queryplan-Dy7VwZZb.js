var e=`// Cost-based query planning — why the ORDER a database joins tables in can change query time by orders\r
// of magnitude, and how the optimizer picks. The cost of a join plan is dominated by the size of the\r
// INTERMEDIATE results it materializes, so the optimizer estimates each candidate's cost from table\r
// cardinalities and join selectivities (the fraction of the cross-product a predicate keeps) and takes\r
// the cheapest. The classic lesson: join the most SELECTIVE edges first to keep intermediates tiny — a\r
// naive order can build a 50-million-row intermediate that a good order avoids entirely. We enumerate\r
// left-deep orders and score them with the System-R cost model. Reference: Selinger et al., "Access Path\r
// Selection in a Relational Database Management System" (SIGMOD 1979).\r
\r
export interface Plan { order: string[]; cost: number; intermediates: number[] }\r
\r
/** Estimate a left-deep plan's cost = sum of intermediate-result cardinalities. Each new table multiplies\r
 *  the running size by its cardinality and by every join selectivity connecting it to the already-joined\r
 *  tables (no connecting predicate ⇒ selectivity 1, i.e. a cross product). */\r
export function planCost(order: string[], card: Record<string, number>, sel: Record<string, number>): Plan {\r
  const key = (a: string, b: string) => [a, b].sort().join('~');\r
  const joined: string[] = [order[0]];\r
  let running = card[order[0]];\r
  const intermediates: number[] = [];\r
  let cost = 0;\r
  for (let k = 1; k < order.length; k++) {\r
    const t = order[k];\r
    let s = 1;\r
    for (const j of joined) s *= sel[key(t, j)] ?? 1;\r
    running = Math.round(running * card[t] * s);\r
    intermediates.push(running);\r
    cost += running;\r
    joined.push(t);\r
  }\r
  return { order, cost, intermediates };\r
}\r
\r
function permutations<T>(arr: T[]): T[][] {\r
  if (arr.length <= 1) return [arr];\r
  const out: T[][] = [];\r
  for (let i = 0; i < arr.length; i++) {\r
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];\r
    for (const p of permutations(rest)) out.push([arr[i], ...p]);\r
  }\r
  return out;\r
}\r
\r
/** Score every left-deep ordering and return them cheapest-first (the optimizer's search space). */\r
export function optimize(tables: string[], card: Record<string, number>, sel: Record<string, number>): Plan[] {\r
  return permutations(tables)\r
    .map((order) => planCost(order, card, sel))\r
    .sort((a, b) => a.cost - b.cost || (a.order.join() < b.order.join() ? -1 : 1));\r
}\r
`;export{e as default};