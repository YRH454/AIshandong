var e=`// Median of medians (the BFPRT algorithm) — how to find the k-th smallest element (a median, a percentile) in\r
// GUARANTEED linear time, even in the worst case. Plain quickselect is O(n) on average but O(n²) if you keep\r
// picking terrible pivots — and an adversary (or just already-sorted input with a naive pivot) can force exactly\r
// that. The fix is to spend a little work choosing a pivot that is provably "not too lopsided." The trick, due\r
// to Blum–Floyd–Pratt–Rivest–Tarjan (1973): break the array into groups of 5, find each group's median (cheap —\r
// five elements), then recursively find the median OF those medians, and use THAT as the pivot. Why it works:\r
// the median-of-medians is ≥ half of the group medians, and each of those is ≥ 2 of its own group's elements, so\r
// the pivot is guaranteed to be greater than at least ~30% of all elements and less than at least ~30% — it can\r
// never land in the extreme 30% tails. That bounds how unbalanced the partition can be, so each recursive step\r
// throws away a constant fraction, giving a linear recurrence T(n) = T(n/5) + T(7n/10) + O(n) that solves to\r
// O(n). The groups of 5 are the magic number: 3 is too small (the recursion doesn't shrink enough) and 7+ costs\r
// more per group for little gain. It's more of theoretical beauty than everyday use (the constant is large, so\r
// real code uses randomized quickselect or introselect), but it's the proof that selection is linear in the\r
// worst case — and the same "recurse on a summary to pick a good pivot" idea shows up throughout algorithms.\r
// Reference: Blum, Floyd, Pratt, Rivest, Tarjan, "Time bounds for selection" (1973).\r
\r
const med5 = (g: number[]): number => [...g].sort((a, b) => a - b)[Math.floor(g.length / 2)];\r
\r
/** The median-of-medians pivot VALUE for arr[lo..hi]. */\r
export function pivotValue(arr: number[], lo: number, hi: number): number {\r
  const medians: number[] = [];\r
  for (let i = lo; i <= hi; i += 5) medians.push(med5(arr.slice(i, Math.min(i + 5, hi + 1))));\r
  return medians.length === 1 ? medians[0] : select(medians, Math.floor(medians.length / 2));\r
}\r
\r
/** Lomuto partition of arr[lo..hi] around the value \`pivot\`; returns the pivot's final index. */\r
function partition(arr: number[], lo: number, hi: number, pivot: number): number {\r
  let pi = lo; while (arr[pi] !== pivot) pi++;\r
  [arr[pi], arr[hi]] = [arr[hi], arr[pi]];\r
  let store = lo;\r
  for (let i = lo; i < hi; i++) if (arr[i] < pivot) { [arr[i], arr[store]] = [arr[store], arr[i]]; store++; }\r
  [arr[store], arr[hi]] = [arr[hi], arr[store]];\r
  return store;\r
}\r
\r
/** The k-th smallest element (0-indexed) of \`a\`, in guaranteed O(n). */\r
export function select(a: number[], k: number): number {\r
  const arr = a.slice();\r
  let lo = 0, hi = arr.length - 1;\r
  for (;;) {\r
    if (lo === hi) return arr[lo];\r
    const p = partition(arr, lo, hi, pivotValue(arr, lo, hi));\r
    if (k === p) return arr[p];\r
    if (k < p) hi = p - 1; else lo = p + 1;\r
  }\r
}\r
\r
export interface PivotAnalysis { groups: number[][]; medians: number[]; pivot: number; less: number; greater: number; equal: number; n: number }\r
\r
/** Expose one level of pivot selection (groups of 5, their medians, the chosen pivot, and its balance). */\r
export function analyze(a: number[]): PivotAnalysis {\r
  const groups: number[][] = [];\r
  for (let i = 0; i < a.length; i += 5) groups.push(a.slice(i, i + 5));\r
  const medians = groups.map(med5);\r
  const pivot = pivotValue(a, 0, a.length - 1);\r
  let less = 0, greater = 0, equal = 0;\r
  for (const x of a) { if (x < pivot) less++; else if (x > pivot) greater++; else equal++; }\r
  return { groups, medians, pivot, less, greater, equal, n: a.length };\r
}\r
`;export{e as default};