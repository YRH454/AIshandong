var e=`// Sorting algorithms, instrumented — each returns the sorted array plus a frame-by-frame\r
// trace (array snapshots with the indices being compared/written) and the comparison/swap\r
// counts, so you can watch HOW each one works and contrast the O(n²) quadratic sorts\r
// (bubble, insertion, selection) with the O(n log n) divide-and-conquer ones (merge, quick).\r
// The point is the trade-offs: bubble/insertion are simple and adaptive on nearly-sorted\r
// data; merge is stable and predictable; quick is fast in practice but worst-case quadratic.\r
// Pure; tested for correctness and for hand-counted operation totals.\r
\r
export interface Frame { array: number[]; active: number[]; sorted: number[] }\r
export interface Trace { result: number[]; frames: Frame[]; comparisons: number; swaps: number }\r
\r
function tracer(arr: number[]) {\r
  const a = [...arr];\r
  const frames: Frame[] = [];\r
  let comparisons = 0, swaps = 0;\r
  const snap = (active: number[], sorted: number[] = []) => frames.push({ array: [...a], active: [...active], sorted: [...sorted] });\r
  return {\r
    a,\r
    cmp: () => comparisons++,\r
    swap: (i: number, j: number) => { [a[i], a[j]] = [a[j], a[i]]; swaps++; },\r
    write: () => swaps++, // a placement (merge) counts as a write, not a swap of two cells\r
    snap,\r
    // snapshot an explicitly-provided full array (used by merge, where the live array is\r
    // mid-rewrite); guarantees every frame stays a true permutation of the input\r
    snapArray: (array: number[], active: number[]) => frames.push({ array: [...array], active: [...active], sorted: [] }),\r
    done: (): Trace => ({ result: [...a], frames, comparisons, swaps }),\r
  };\r
}\r
\r
export function bubbleSort(arr: number[]): Trace {\r
  const t = tracer(arr); const n = t.a.length;\r
  const sorted: number[] = [];\r
  for (let i = 0; i < n - 1; i++) {\r
    for (let j = 0; j < n - 1 - i; j++) {\r
      t.cmp(); t.snap([j, j + 1], sorted);\r
      if (t.a[j] > t.a[j + 1]) { t.swap(j, j + 1); t.snap([j, j + 1], sorted); }\r
    }\r
    sorted.unshift(n - 1 - i);\r
  }\r
  return t.done();\r
}\r
\r
export function insertionSort(arr: number[]): Trace {\r
  const t = tracer(arr); const n = t.a.length;\r
  for (let i = 1; i < n; i++) {\r
    let j = i;\r
    while (j > 0) { t.cmp(); t.snap([j - 1, j]); if (t.a[j - 1] <= t.a[j]) break; t.swap(j - 1, j); j--; }\r
  }\r
  return t.done();\r
}\r
\r
export function selectionSort(arr: number[]): Trace {\r
  const t = tracer(arr); const n = t.a.length;\r
  const sorted: number[] = [];\r
  for (let i = 0; i < n - 1; i++) {\r
    let min = i;\r
    for (let j = i + 1; j < n; j++) { t.cmp(); t.snap([min, j], sorted); if (t.a[j] < t.a[min]) min = j; }\r
    if (min !== i) t.swap(i, min);\r
    sorted.push(i); t.snap([i, min], sorted);\r
  }\r
  return t.done();\r
}\r
\r
export function mergeSort(arr: number[]): Trace {\r
  const t = tracer(arr);\r
  const merge = (lo: number, mid: number, hi: number) => {\r
    const left = t.a.slice(lo, mid + 1), right = t.a.slice(mid + 1, hi + 1);\r
    let i = 0, j = 0;\r
    const merged: number[] = [];\r
    // a snapshot of the WHOLE array: untouched prefix + merged-so-far + the not-yet-placed\r
    // remainders of left/right + untouched suffix — always a permutation of the input\r
    const snapMerge = () => t.snapArray(\r
      [...t.a.slice(0, lo), ...merged, ...left.slice(i), ...right.slice(j), ...t.a.slice(hi + 1)],\r
      [lo + merged.length - 1],\r
    );\r
    while (i < left.length && j < right.length) {\r
      t.cmp();\r
      if (left[i] <= right[j]) merged.push(left[i++]); else merged.push(right[j++]);\r
      t.write(); snapMerge();\r
    }\r
    while (i < left.length) { merged.push(left[i++]); t.write(); snapMerge(); }\r
    while (j < right.length) { merged.push(right[j++]); t.write(); snapMerge(); }\r
    for (let x = 0; x < merged.length; x++) t.a[lo + x] = merged[x]; // commit the merged run\r
  };\r
  const rec = (lo: number, hi: number) => { if (lo >= hi) return; const mid = (lo + hi) >> 1; rec(lo, mid); rec(mid + 1, hi); merge(lo, mid, hi); };\r
  rec(0, t.a.length - 1);\r
  return t.done();\r
}\r
\r
export function quickSort(arr: number[]): Trace {\r
  const t = tracer(arr);\r
  const part = (lo: number, hi: number): number => {\r
    const pivot = t.a[hi]; let i = lo;\r
    for (let j = lo; j < hi; j++) { t.cmp(); t.snap([j, hi]); if (t.a[j] < pivot) { if (i !== j) t.swap(i, j); i++; } }\r
    if (i !== hi) t.swap(i, hi); t.snap([i, hi]);\r
    return i;\r
  };\r
  const rec = (lo: number, hi: number) => { if (lo >= hi) return; const p = part(lo, hi); rec(lo, p - 1); rec(p + 1, hi); };\r
  rec(0, t.a.length - 1);\r
  return t.done();\r
}\r
\r
export const ALGOS = { bubble: bubbleSort, insertion: insertionSort, selection: selectionSort, merge: mergeSort, quick: quickSort };\r
export type AlgoName = keyof typeof ALGOS;\r
`;export{e as default};