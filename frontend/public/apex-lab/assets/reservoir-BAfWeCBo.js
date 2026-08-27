var e=`// Reservoir sampling (Algorithm R, Vitter 1985) — pick k items uniformly at random from a\r
// stream of UNKNOWN, possibly unbounded length, in one pass using only O(k) memory. You\r
// can't store the whole stream and you don't know n in advance, yet every item must end up\r
// with the same probability k/n of being kept. The trick: keep the first k items, then for\r
// the i-th item (i > k) keep it with probability k/i, and if kept, have it evict a uniformly\r
// random one of the current k. A short induction shows this keeps every item with probability\r
// exactly k/n at all times. It's how you sample log lines, pick a random row while scanning,\r
// or A/B-bucket an unbounded event stream. The randomness is injected so the mechanics are\r
// testable; the uniformity is the statistical payoff.\r
\r
export interface Step { index: number; value: number; kept: boolean; evicted: number | null }\r
export interface Result { reservoir: number[]; steps: Step[] }\r
\r
/** @param rand a () => [0,1) source (injected for determinism). */\r
export function sample(stream: number[], k: number, rand: () => number): Result {\r
  const reservoir: number[] = [];\r
  const steps: Step[] = [];\r
  for (let i = 0; i < stream.length; i++) {\r
    const v = stream[i];\r
    if (i < k) { reservoir.push(v); steps.push({ index: i, value: v, kept: true, evicted: null }); continue; }\r
    const j = Math.floor(rand() * (i + 1)); // uniform in [0, i]\r
    if (j < k) { const evicted = reservoir[j]; reservoir[j] = v; steps.push({ index: i, value: v, kept: true, evicted }); }\r
    else steps.push({ index: i, value: v, kept: false, evicted: null });\r
  }\r
  return { reservoir, steps };\r
}\r
\r
/** Mulberry32 PRNG — a tiny seedable generator so tests are reproducible. */\r
export function mulberry32(seed: number): () => number {\r
  let s = seed >>> 0;\r
  return () => {\r
    s = (s + 0x6d2b79f5) | 0;\r
    let t = Math.imul(s ^ (s >>> 15), 1 | s);\r
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;\r
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;\r
  };\r
}\r
`;export{e as default};