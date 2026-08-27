var e=`// DDSketch — a streaming quantile sketch (Datadog's, hence the name) that answers "what's my p99 latency?" with\r
// a guaranteed RELATIVE error, using tiny memory and merging cleanly across machines. The tension it resolves:\r
// exact percentiles need all the data (huge), and naive fixed-width histograms give you ABSOLUTE error — a\r
// 10ms-wide bucket is fine at 5ms but useless at 5s. Latency spans many orders of magnitude, so what you\r
// actually want is relative accuracy: "p99 is 2.0s ± 1%," equally tight at 5ms and 5s. DDSketch gets that with\r
// one idea: LOGARITHMIC bucket boundaries. Pick a relative accuracy α (say 1%), set γ = (1+α)/(1-α), and map a\r
// value v to bucket i = ⌈log_γ v⌉ — so consecutive bucket edges are a constant FACTOR γ apart, not a constant\r
// distance. Every value in bucket i is within α (relatively) of the bucket's representative x = 2γ^i/(γ+1), so\r
// any quantile read back from the counts is guaranteed within α of the true value. Because latencies cluster\r
// over a bounded range of magnitudes, you only need a few hundred buckets to cover microseconds-to-minutes. And\r
// since a sketch is just a map of bucket→count, two sketches MERGE by adding counts — so every server keeps its\r
// own and a collector sums them into a global p99 without ever shipping raw samples. This models the sketch,\r
// its quantiles, the error guarantee, and merging. Reference: Masson, Rim, Lee, "DDSketch" (VLDB 2019).\r
\r
export class DDSketch {\r
  readonly alpha: number;\r
  readonly gamma: number;\r
  buckets = new Map<number, number>();   // bucket index → count\r
  count = 0;\r
\r
  constructor(alpha: number) { this.alpha = alpha; this.gamma = (1 + alpha) / (1 - alpha); }\r
\r
  /** The bucket index for a positive value: ⌈log_γ v⌉. */\r
  key(v: number): number { return Math.ceil(Math.log(v) / Math.log(this.gamma)); }\r
\r
  /** The representative value of a bucket — within α (relative) of every value that maps to it. */\r
  representative(i: number): number { return (2 * Math.pow(this.gamma, i)) / (this.gamma + 1); }\r
\r
  add(v: number): void {\r
    if (v <= 0) return;                  // this sketch covers positive values (latencies, sizes)\r
    const i = this.key(v);\r
    this.buckets.set(i, (this.buckets.get(i) ?? 0) + 1);\r
    this.count++;\r
  }\r
\r
  /** Estimate the q-quantile (0..1) with relative error ≤ α. */\r
  quantile(q: number): number {\r
    if (this.count === 0) return NaN;\r
    const rank = Math.max(1, Math.ceil(q * this.count));   // 1-indexed target rank\r
    const keys = [...this.buckets.keys()].sort((a, b) => a - b);\r
    let cum = 0;\r
    for (const i of keys) { cum += this.buckets.get(i)!; if (cum >= rank) return this.representative(i); }\r
    return this.representative(keys[keys.length - 1]);\r
  }\r
\r
  /** Merge another sketch (same α) into this one — just add bucket counts. */\r
  merge(other: DDSketch): void {\r
    for (const [i, c] of other.buckets) this.buckets.set(i, (this.buckets.get(i) ?? 0) + c);\r
    this.count += other.count;\r
  }\r
\r
  /** Number of buckets — the memory footprint, independent of how many values were added. */\r
  get size(): number { return this.buckets.size; }\r
}\r
\r
/** Exact quantile of an array — the ground truth (nearest-rank). */\r
export function exactQuantile(values: number[], q: number): number {\r
  const s = [...values].sort((a, b) => a - b);\r
  const rank = Math.max(1, Math.ceil(q * s.length));\r
  return s[rank - 1];\r
}\r
`;export{e as default};