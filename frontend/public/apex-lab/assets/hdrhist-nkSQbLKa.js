var e=`// HdrHistogram — how you record latencies and read back p50/p99/p99.9 without storing every sample. The\r
// naive way (keep all values, sort, index) costs O(n) memory and is hopeless at scale. A plain fixed-bucket\r
// histogram either wastes resolution on the common small values or can't reach the rare huge ones. HDR\r
// ("High Dynamic Range") uses LOG-LINEAR buckets: split the value range into power-of-two octaves, and each\r
// octave into S equal sub-buckets. That gives CONSTANT RELATIVE error (~1/S) across the whole range — 3%\r
// resolution whether the value is 10µs or 10s — with memory that grows only with the range, not the sample\r
// count. Record is O(1), any percentile is a cheap scan. It's the standard for latency measurement (wrk2,\r
// JMH, Cassandra, Kafka). Reference: Gil Tene's HdrHistogram.\r
\r
/** Relative error bound for S sub-buckets per octave: a value is stored within a factor (1 + 1/S). */\r
export const relativeError = (S: number): number => 1 / S;\r
\r
/** Snap a value down to its bucket's lower bound. Within octave [2^m, 2^{m+1}) the sub-bucket width is\r
 *  2^m / S, so the rounding error is < value/S — a constant relative error, independent of magnitude. */\r
export function quantize(v: number, S: number): number {\r
  if (v <= 0) return 0;\r
  const m = Math.floor(Math.log2(v));\r
  const step = Math.max(1, Math.pow(2, m) / S); // sub-bucket width in this octave (>=1 for small values)\r
  return Math.floor(v / step) * step;\r
}\r
\r
export interface Bucket { lo: number; count: number }\r
\r
/** A recording latency histogram with ~1/S relative error. */\r
export class HdrHist {\r
  private counts = new Map<number, number>();\r
  private total = 0;\r
  constructor(private S = 8) {}\r
\r
  record(v: number): void {\r
    const q = quantize(v, this.S);\r
    this.counts.set(q, (this.counts.get(q) ?? 0) + 1);\r
    this.total++;\r
  }\r
\r
  count(): number { return this.total; }\r
  /** Distinct buckets in use — the memory footprint, bounded by (octaves × S), NOT by sample count. */\r
  bucketCount(): number { return this.counts.size; }\r
\r
  /** The value at percentile p (0–100): the bucket lower bound where the cumulative count first crosses p%. */\r
  percentile(p: number): number {\r
    if (this.total === 0) return 0;\r
    const target = (p / 100) * this.total;\r
    const keys = [...this.counts.keys()].sort((a, b) => a - b);\r
    let cum = 0;\r
    for (const k of keys) { cum += this.counts.get(k)!; if (cum >= target) return k; }\r
    return keys[keys.length - 1];\r
  }\r
\r
  buckets(): Bucket[] {\r
    return [...this.counts.entries()].map(([lo, count]) => ({ lo, count })).sort((a, b) => a.lo - b.lo);\r
  }\r
}\r
`;export{e as default};