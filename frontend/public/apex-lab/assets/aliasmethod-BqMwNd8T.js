var e=`// The Alias method (Vose) — sample from a weighted discrete distribution in O(1) time per draw, after O(n)\r
// setup. The naive way (build a cumulative array, draw a uniform, binary-search) is O(log n) per sample and\r
// awkward to update. The alias method is cleverer: it chops the n weights into exactly n "buckets" each of\r
// equal total probability 1/n, where each bucket is at most TWO outcomes — a primary and an "alias". To\r
// sample you roll one n-sided die to pick a bucket, then flip one biased coin to choose the bucket's primary\r
// or its alias. Two O(1) lookups, done. The magic is the setup: repeatedly pair an under-full outcome\r
// (weight < average) with an over-full one, letting the over-full one donate its excess as the under-full\r
// one's alias. Used in Monte-Carlo sampling, weighted load balancing, population genetics, and procedural\r
// generation. Reference: Walker (1977); Vose (1991).\r
\r
export interface AliasTable { prob: number[]; alias: number[]; n: number }\r
\r
/** Build the alias table from non-negative weights (need not sum to 1). O(n). */\r
export function buildAlias(weights: number[]): AliasTable {\r
  const n = weights.length;\r
  const total = weights.reduce((a, b) => a + b, 0);\r
  const scaled = weights.map((w) => (w * n) / total); // scale so the average weight is exactly 1\r
  const prob = new Array(n).fill(0);\r
  const alias = new Array(n).fill(0);\r
\r
  const small: number[] = [], large: number[] = [];\r
  scaled.forEach((s, i) => (s < 1 ? small : large).push(i));\r
\r
  while (small.length && large.length) {\r
    const s = small.pop()!, l = large.pop()!;\r
    prob[s] = scaled[s];         // bucket s is filled to scaled[s] by outcome s…\r
    alias[s] = l;                // …and the rest by outcome l\r
    scaled[l] = scaled[l] - (1 - scaled[s]); // l donates that slice; recompute its remaining mass\r
    (scaled[l] < 1 ? small : large).push(l);\r
  }\r
  // leftovers are exactly full (floating point drift aside)\r
  while (large.length) prob[large.pop()!] = 1;\r
  while (small.length) prob[small.pop()!] = 1;\r
  return { prob, alias, n };\r
}\r
\r
/** Draw a sample given a bucket index (0..n-1) and a coin in [0,1): take the bucket's primary or its alias. */\r
export function sample(t: AliasTable, bucket: number, coin: number): number {\r
  return coin < t.prob[bucket] ? bucket : t.alias[bucket];\r
}\r
\r
/** The effective probability the table assigns to outcome j — for verification. Bucket j contributes prob[j]\r
 *  to j, and every bucket i whose alias is j contributes (1 − prob[i]); each bucket is weighted 1/n. */\r
export function effectiveProbability(t: AliasTable, j: number): number {\r
  let p = t.prob[j];\r
  for (let i = 0; i < t.n; i++) if (i !== j && t.alias[i] === j) p += 1 - t.prob[i];\r
  return p / t.n;\r
}\r
`;export{e as default};