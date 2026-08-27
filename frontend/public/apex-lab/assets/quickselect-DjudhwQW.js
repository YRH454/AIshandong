var e=`// Quickselect — find the k-th smallest element WITHOUT fully sorting, in O(n) average time. It's quicksort\r
// that only recurses into the side containing the answer: partition around a pivot, and the pivot lands at\r
// its final sorted position p. If p === k you're done; if k < p the answer is to the left, else to the\r
// right — so you discard the other half each time. The expected work is n + n/2 + n/4 + … ≈ 2n, versus\r
// O(n log n) to sort just to read one element. It's how you get a median or a p99 latency in linear time;\r
// databases and analytics engines use it (and its cousin introselect / median-of-medians for the\r
// worst-case guarantee). Reference: Hoare's FIND (1961); CLRS §9.2.\r
\r
export interface QsStep { lo: number; hi: number; pivotValue: number; landedAt: number; goesLeft: boolean | null }\r
export interface QsResult { value: number; steps: QsStep[]; comparisons: number; sortedAt: number }\r
\r
const medianOfThreeIndex = (a: number[], i: number, j: number, k: number): number => {\r
  const x = a[i], y = a[j], z = a[k];\r
  if ((x <= y && y <= z) || (z <= y && y <= x)) return j;\r
  if ((y <= x && x <= z) || (z <= x && x <= y)) return i;\r
  return k;\r
};\r
\r
/** Return the k-th smallest (0-indexed) of \`input\`, with the partition trace. Deterministic median-of-three\r
 *  pivot (no RNG) so it's reproducible. Throws if k is out of range. */\r
export function quickselect(input: number[], k: number): QsResult {\r
  if (k < 0 || k >= input.length) throw new Error(\`k=\${k} out of range for length \${input.length}\`);\r
  const a = [...input];\r
  const swap = (i: number, j: number) => { const t = a[i]; a[i] = a[j]; a[j] = t; };\r
  const steps: QsStep[] = [];\r
  let lo = 0, hi = a.length - 1, comparisons = 0;\r
\r
  for (;;) {\r
    if (lo === hi) { steps.push({ lo, hi, pivotValue: a[lo], landedAt: lo, goesLeft: null }); return { value: a[lo], steps, comparisons, sortedAt: lo }; }\r
    // choose a median-of-three pivot and park it at hi\r
    const mid = (lo + hi) >> 1;\r
    swap(medianOfThreeIndex(a, lo, mid, hi), hi);\r
    const pivotValue = a[hi];\r
    // Lomuto partition: everything < pivot moves to the front\r
    let i = lo;\r
    for (let j = lo; j < hi; j++) { comparisons++; if (a[j] < pivotValue) { swap(i, j); i++; } }\r
    swap(i, hi); // pivot reaches its final sorted index i\r
    const goesLeft = k === i ? null : k < i;\r
    steps.push({ lo, hi, pivotValue, landedAt: i, goesLeft });\r
    if (i === k) return { value: a[i], steps, comparisons, sortedAt: i };\r
    if (k < i) hi = i - 1; else lo = i + 1; // recurse into the side holding k only\r
  }\r
}\r
`;export{e as default};