var e=`// Fisher–Yates shuffle — the right way to shuffle an array, and the one-character bug that makes the popular\r
// "naive" version subtly, provably biased. The correct algorithm walks from the last index down and swaps each\r
// element with a random one at or BEFORE it (index j in [0, i]); this produces each of the n! orderings with\r
// exactly equal probability. The naive version people reach for — walk every index i and swap it with a random\r
// index anywhere in [0, n−1] — looks just as random but isn't: it makes n choices of n options each, so n^n\r
// equally-likely execution paths, and n^n is almost never divisible by n!, so the paths CAN'T map evenly onto\r
// the n! orderings. Some permutations come up more than others. You can't see it by eye — you see it by\r
// running the shuffle millions of times and tallying where each value lands. This models both and measures the\r
// bias. Reference: Fisher & Yates (1938); Knuth (TAOCP vol. 2); the classic "how to shuffle" write-ups.\r
\r
export type RNG = () => number; // returns a float in [0, 1)\r
\r
/** A tiny deterministic PRNG (LCG) so results are reproducible — no Math.random. */\r
export function makeRng(seed: number): RNG {\r
  let s = seed >>> 0;\r
  // divide by 2^31 (not the mask 0x7fffffff) so the result is a true [0,1) — never exactly 1.0, which would\r
  // make floor(rng()*range) index out of bounds and yield a non-permutation.\r
  return () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x80000000; };\r
}\r
\r
/** Correct: each i swaps with a random index in [0, i]. Uniform over all n! permutations. */\r
export function fisherYates(arr: number[], rng: RNG): void {\r
  for (let i = arr.length - 1; i > 0; i--) {\r
    const j = Math.floor(rng() * (i + 1)); // 0..i\r
    [arr[i], arr[j]] = [arr[j], arr[i]];\r
  }\r
}\r
\r
/** Naive (biased): each i swaps with a random index in [0, n-1]. Looks random, isn't uniform. */\r
export function naiveShuffle(arr: number[], rng: RNG): void {\r
  const n = arr.length;\r
  for (let i = 0; i < n; i++) {\r
    const j = Math.floor(rng() * n); // 0..n-1  ← the bug\r
    [arr[i], arr[j]] = [arr[j], arr[i]];\r
  }\r
}\r
\r
export const isPermutation = (arr: number[]): boolean => {\r
  const seen = new Set(arr);\r
  return seen.size === arr.length && arr.every((v) => v >= 0 && v < arr.length);\r
};\r
\r
/** Run a shuffle \`trials\` times over [0..n-1] and return matrix[position][value] = probability it landed there. */\r
export function distribution(shuffle: (a: number[], r: RNG) => void, n: number, trials: number, rng: RNG): number[][] {\r
  const counts = Array.from({ length: n }, () => new Array(n).fill(0));\r
  for (let t = 0; t < trials; t++) {\r
    const arr = Array.from({ length: n }, (_, i) => i);\r
    shuffle(arr, rng);\r
    for (let pos = 0; pos < n; pos++) counts[pos][arr[pos]]++;\r
  }\r
  return counts.map((row) => row.map((c) => c / trials));\r
}\r
\r
/** Largest relative deviation of any cell from the uniform ideal 1/n (0 = perfectly uniform). */\r
export function maxBias(matrix: number[][], n: number): number {\r
  const ideal = 1 / n;\r
  let m = 0;\r
  for (const row of matrix) for (const p of row) m = Math.max(m, Math.abs(p - ideal) / ideal);\r
  return m;\r
}\r
`;export{e as default};