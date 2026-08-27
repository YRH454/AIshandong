var e=`// Mixture of Experts — how a model can have hundreds of billions of parameters but only spend a fraction per token. An\r
// MoE layer replaces one feed-forward network with N expert FFNs plus a router. For each token the router scores every\r
// expert; only the top-k actually run, and their outputs are combined weighted by a softmax over those k scores. So the\r
// model HAS N experts' worth of parameters but ACTIVATES only k of them — capacity decoupled from compute. The other\r
// half of the story is load balancing: a router that favours a few experts wastes the rest and bottlenecks the popular\r
// ones, so training adds a loss that pushes tokens to spread out. This models routing, sparsity, and per-expert load.\r
\r
// Indices of the k highest scores, most-preferred first.\r
export function topK(scores: number[], k: number): number[] {\r
  return scores\r
    .map((s, i) => ({ s, i }))\r
    .sort((a, b) => b.s - a.s)\r
    .slice(0, k)\r
    .map((x) => x.i);\r
}\r
\r
// Softmax over the SELECTED experts' scores (the gate weights the outputs are combined with). Aligned to \`selected\`.\r
export function gateWeights(scores: number[], selected: number[]): number[] {\r
  const picked = selected.map((i) => scores[i]);\r
  const m = Math.max(...picked);\r
  const exps = picked.map((s) => Math.exp(s - m));\r
  const sum = exps.reduce((a, b) => a + b, 0);\r
  return exps.map((e) => e / sum);\r
}\r
\r
export interface Sparsity { activeB: number; totalB: number; pct: number }\r
// With N experts of \`expertParamsB\` billion params each and k active per token.\r
export function sparsity(nExperts: number, k: number, expertParamsB: number): Sparsity {\r
  const totalB = nExperts * expertParamsB;\r
  const activeB = k * expertParamsB;\r
  return { activeB, totalB, pct: Math.round((k / nExperts) * 100) };\r
}\r
\r
// Per-expert token count over a batch of routings (each routing is the top-k indices for one token).\r
export function load(routings: number[][], nExperts: number): number[] {\r
  const counts = new Array(nExperts).fill(0);\r
  for (const r of routings) for (const e of r) counts[e]++;\r
  return counts;\r
}\r
\r
// A router is "balanced" when no expert is dramatically busier than the average (imbalance = max/mean < 1.5).\r
export function imbalance(loads: number[]): number {\r
  const total = loads.reduce((a, b) => a + b, 0);\r
  if (total === 0) return 0;\r
  const mean = total / loads.length;\r
  return Math.max(...loads) / mean;\r
}\r
`;export{e as default};