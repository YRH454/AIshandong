var e=`// Bellman–Ford — single-source shortest paths that, unlike Dijkstra, tolerates NEGATIVE edge weights and\r
// can DETECT a negative-weight cycle (where "shortest" stops being well-defined: you could loop forever\r
// getting cheaper). The idea is brute-force relaxation: a shortest path has at most V−1 edges, so relaxing\r
// every edge V−1 times is enough to settle all distances. If a Vth pass can STILL relax some edge, a\r
// negative cycle is reachable. The cycle-detection half powers a beautiful real-world trick: model\r
// currency exchange rates as a graph with weight = −ln(rate); a negative cycle is then a sequence of\r
// trades whose rates multiply to more than 1 — risk-free ARBITRAGE. References: Bellman (1958), Ford\r
// (1956); CLRS §24.1.\r
\r
export interface Edge { u: number; v: number; w: number }\r
\r
export interface BfResult {\r
  dist: number[];                 // shortest distance from source (Infinity if unreachable)\r
  pred: number[];                 // predecessor on the shortest path (-1 if none)\r
  rounds: number[][];             // dist snapshot after each of the V-1 relaxation passes (for the viz)\r
  hasNegativeCycle: boolean;      // a negative-weight cycle is reachable from the source\r
  negativeCycle: number[] | null; // the cycle as a node list (first === last), or null\r
}\r
\r
/** Run Bellman–Ford from \`source\` over \`n\` nodes. Records each relaxation pass so the UI can animate the\r
 *  distances settling, and reconstructs a negative cycle if one is reachable. */\r
export function bellmanFord(n: number, edges: Edge[], source: number): BfResult {\r
  const dist = new Array(n).fill(Infinity);\r
  const pred = new Array(n).fill(-1);\r
  dist[source] = 0;\r
  const rounds: number[][] = [];\r
\r
  // V-1 relaxation passes settle every shortest path (paths have ≤ V-1 edges).\r
  for (let i = 0; i < n - 1; i++) {\r
    let changed = false;\r
    for (const e of edges) {\r
      if (dist[e.u] !== Infinity && dist[e.u] + e.w < dist[e.v]) {\r
        dist[e.v] = dist[e.u] + e.w;\r
        pred[e.v] = e.u;\r
        changed = true;\r
      }\r
    }\r
    rounds.push([...dist]);\r
    if (!changed) break; // early exit once nothing moves — distances are stable\r
  }\r
\r
  // One more pass: any edge that STILL relaxes lies on / downstream of a negative cycle.\r
  let onCycle = -1;\r
  for (const e of edges) {\r
    if (dist[e.u] !== Infinity && dist[e.u] + e.w < dist[e.v]) { onCycle = e.v; pred[e.v] = e.u; break; }\r
  }\r
\r
  if (onCycle === -1) return { dist, pred, rounds, hasNegativeCycle: false, negativeCycle: null };\r
\r
  // Step back V times to land *inside* the cycle (not just on a path leading to it), then walk it.\r
  let x = onCycle;\r
  for (let i = 0; i < n; i++) x = pred[x];\r
  const cycle: number[] = [];\r
  let cur = x;\r
  do { cycle.push(cur); cur = pred[cur]; } while (cur !== x && cycle.length <= n);\r
  cycle.push(x);\r
  cycle.reverse();\r
  return { dist, pred, rounds, hasNegativeCycle: true, negativeCycle: cycle };\r
}\r
\r
export interface Rate { from: string; to: string; rate: number }\r
export interface Arbitrage { cycle: string[]; profit: number }\r
\r
/** Detect a risk-free arbitrage loop among \`currencies\` given directed exchange \`rates\`. Builds the\r
 *  −ln(rate) graph (so a path's total weight = −ln of the product of rates), adds a zero-weight virtual\r
 *  source reaching every node (so a cycle anywhere is found), and reports the loop + its profit multiplier\r
 *  (>1 means free money). Returns null if no arbitrage exists. */\r
export function detectArbitrage(currencies: string[], rates: Rate[]): Arbitrage | null {\r
  const idx = new Map(currencies.map((c, i) => [c, i]));\r
  const n = currencies.length;\r
  const edges: Edge[] = [];\r
  for (const r of rates) {\r
    const u = idx.get(r.from), v = idx.get(r.to);\r
    if (u === undefined || v === undefined || r.rate <= 0) continue;\r
    edges.push({ u, v, w: -Math.log(r.rate) });\r
  }\r
  // Virtual source n → every currency, weight 0, so unreachable components are still scanned.\r
  for (let i = 0; i < n; i++) edges.push({ u: n, v: i, w: 0 });\r
\r
  const res = bellmanFord(n + 1, edges, n);\r
  if (!res.hasNegativeCycle || !res.negativeCycle) return null;\r
\r
  // The reported cycle is in node space; the virtual source can't be on a cycle (no incoming edges),\r
  // so every node maps to a real currency. The pred-walk may yield the loop in either direction, so\r
  // orient it to follow real directed edges before multiplying the rates.\r
  const hasRate = (a: string, b: string) => rates.some((r) => r.from === a && r.to === b);\r
  const names = res.negativeCycle.filter((i) => i < n).map((i) => currencies[i]);\r
  const seq = names.length >= 2 && !hasRate(names[0], names[1]) ? [...names].reverse() : names;\r
  let profit = 1;\r
  for (let i = 0; i < seq.length - 1; i++) {\r
    const r = rates.find((x) => x.from === seq[i] && x.to === seq[i + 1]);\r
    if (r) profit *= r.rate;\r
  }\r
  return { cycle: seq, profit };\r
}\r
`;export{e as default};