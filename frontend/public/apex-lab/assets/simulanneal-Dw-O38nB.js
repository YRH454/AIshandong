var e=`// Simulated annealing — how to find a good solution to a hard problem when the search space is full of traps.\r
// Plain "greedy" descent (always move downhill) gets stuck in the first local minimum it falls into, like a ball\r
// rolling into the nearest dip even though a far deeper valley sits over the next hill. Annealing borrows a trick\r
// from metallurgy: heat a metal and the atoms jiggle freely; cool it slowly and they settle into a low-energy\r
// crystal, but cool too fast and they freeze into a flawed high-energy state. So the algorithm keeps a\r
// TEMPERATURE T that starts high and cools. At each step it proposes a random move; if the move is downhill it\r
// always takes it, but if it's UPHILL by ΔE it takes it anyway with probability exp(−ΔE/T). Hot (large T) → it\r
// accepts almost any uphill move and roams freely, escaping traps; cold (T→0) → it accepts only improvements and\r
// settles. Cool slowly enough and it converges to the global optimum with probability approaching 1. It's the\r
// go-to method for messy combinatorial problems — VLSI chip placement, the traveling salesman, scheduling — where\r
// the landscape is too rugged for gradient methods and too big to brute-force. This models a 1-D cost landscape\r
// with a deceptive local minimum, and contrasts annealing against greedy descent. Reference: Kirkpatrick, Gelatt\r
// & Vecchi, "Optimization by Simulated Annealing," Science (1983); the Metropolis acceptance criterion (1953).\r
\r
/** A 1-D cost landscape: a deep GLOBAL well near index 12 and a shallower LOCAL well near index 44. */\r
export function makeLandscape(n = 60): number[] {\r
  const global = (i: number) => 0.05 * (i - 12) ** 2;        // deep global well, min 0 at i=12\r
  const local = (i: number) => 0.05 * (i - 44) ** 2 + 4;      // shallow local well, min 4 at i=44\r
  return Array.from({ length: n }, (_, i) => Math.min(global(i), local(i))); // barrier ~14.5 between them\r
}\r
\r
/** The Metropolis acceptance probability: downhill always; uphill by ΔE with prob exp(−ΔE/T). */\r
export const acceptProb = (dE: number, T: number): number => (dE <= 0 ? 1 : Math.exp(-dE / T));\r
\r
export interface GreedyResult { path: number[]; end: number }\r
/** Greedy descent — always step to a strictly-lower neighbour; stops at the first local minimum. */\r
export function greedyDescent(land: number[], start: number): GreedyResult {\r
  let i = start; const path = [i];\r
  for (;;) {\r
    const nbrs = [i - 1, i + 1].filter((j) => j >= 0 && j < land.length);\r
    const best = nbrs.reduce((a, b) => (land[b] < land[a] ? b : a), i);\r
    if (land[best] >= land[i]) break; // no downhill neighbour → stuck\r
    i = best; path.push(i);\r
  }\r
  return { path, end: i };\r
}\r
\r
export interface AnnealStep { i: number; T: number; dE: number; accepted: boolean }\r
export interface AnnealResult { path: AnnealStep[]; best: number; end: number }\r
/** Simulated annealing with a geometric cooling schedule. \`rng\` returns [0,1). */\r
export function anneal(land: number[], start: number, opts: { T0: number; alpha: number; steps: number }, rng: () => number): AnnealResult {\r
  let i = start, T = opts.T0, best = i;\r
  const path: AnnealStep[] = [{ i, T, dE: 0, accepted: true }];\r
  for (let s = 0; s < opts.steps; s++) {\r
    const j = i + (rng() < 0.5 ? -1 : 1);\r
    if (j < 0 || j >= land.length) { path.push({ i, T, dE: 0, accepted: false }); T *= opts.alpha; continue; }\r
    const dE = land[j] - land[i];\r
    const accepted = dE <= 0 || rng() < acceptProb(dE, T);\r
    if (accepted) { i = j; if (land[i] < land[best]) best = i; }\r
    path.push({ i, T, dE, accepted });\r
    T *= opts.alpha;\r
  }\r
  return { path, best, end: i };\r
}\r
\r
/** A small seeded LCG in [0,1) for reproducible runs. */\r
export function makeRng(seed: number): () => number {\r
  let s = seed >>> 0 || 1;\r
  return () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x80000000; };\r
}\r
`;export{e as default};