var e=`// Binary heap / priority queue — a complete binary tree (stored compactly in an array)\r
// where every parent is ≤ its children (a min-heap), so the smallest element is always at\r
// the root, readable in O(1). Insert by appending at the end and SIFTING UP (swapping with\r
// the parent while smaller); remove-min by moving the last element to the root and SIFTING\r
// DOWN (swapping with the smaller child while larger). Both touch only one root-to-leaf\r
// path, so they're O(log n). It's the engine behind Dijkstra and A*'s frontier, Huffman\r
// tree construction, heapsort, and event/task schedulers. Array layout: parent(i)=⌊(i−1)/2⌋,\r
// children 2i+1 and 2i+2. Pure, tested.\r
\r
export interface Heap { data: number[] }\r
export const create = (): Heap => ({ data: [] });\r
\r
const swap = (a: number[], i: number, j: number) => { [a[i], a[j]] = [a[j], a[i]]; };\r
\r
/** Insert and sift up; returns the indices visited (for the visualization). */\r
export function push(h: Heap, value: number): number[] {\r
  const a = h.data;\r
  a.push(value);\r
  let i = a.length - 1;\r
  const path = [i];\r
  while (i > 0) {\r
    const p = (i - 1) >> 1;\r
    if (a[p] <= a[i]) break;\r
    swap(a, i, p); i = p; path.push(i);\r
  }\r
  return path;\r
}\r
\r
/** Remove and return the minimum (the root), sifting the replacement down. */\r
export function pop(h: Heap): { min: number | null; path: number[] } {\r
  const a = h.data;\r
  if (a.length === 0) return { min: null, path: [] };\r
  const min = a[0];\r
  const last = a.pop()!;\r
  if (a.length === 0) return { min, path: [] };\r
  a[0] = last;\r
  let i = 0;\r
  const path = [0];\r
  for (;;) {\r
    const l = 2 * i + 1, r = 2 * i + 2;\r
    let smallest = i;\r
    if (l < a.length && a[l] < a[smallest]) smallest = l;\r
    if (r < a.length && a[r] < a[smallest]) smallest = r;\r
    if (smallest === i) break;\r
    swap(a, i, smallest); i = smallest; path.push(i);\r
  }\r
  return { min, path };\r
}\r
\r
export const peek = (h: Heap): number | null => (h.data.length ? h.data[0] : null);\r
\r
/** Is the heap property satisfied everywhere? (for tests / honesty) */\r
export function isValid(h: Heap): boolean {\r
  const a = h.data;\r
  for (let i = 1; i < a.length; i++) if (a[(i - 1) >> 1] > a[i]) return false;\r
  return true;\r
}\r
\r
/** Pop everything — yields a sorted sequence (heapsort). */\r
export function drain(h: Heap): number[] {\r
  const out: number[] = [];\r
  let r = pop(h);\r
  while (r.min !== null) { out.push(r.min); r = pop(h); }\r
  return out;\r
}\r
`;export{e as default};