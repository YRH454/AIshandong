var e=`// The pairing heap — a heap that is trivially simple to implement yet fast enough that it's a standard choice for\r
// Dijkstra and Prim (it's in Boost and the GNU C++ policy library). A binary heap lives in an array and is great\r
// for push/pop, but it can't cheaply MERGE two heaps or decrease a key — operations a shortest-path algorithm\r
// leans on. Mergeable heaps fix that; the pairing heap is the one that's both easy and fast in practice. It's a\r
// single multi-way tree obeying the heap property (every node's key <= its children's), and almost everything is\r
// built from one primitive, MELD: to merge two heaps, compare roots and hang the larger-rooted tree as the new\r
// first child of the smaller root — O(1). insert is meld with a one-node heap; find-min is just the root. The\r
// only real work is DELETE-MIN: remove the root and you're left with a forest of its children to recombine. The\r
// naive way — meld them left to right into one — is what makes the amortized cost bad; the pairing heap's trick\r
// is a TWO-PASS merge. Pass 1 melds the children in PAIRS left to right (this is the "pairing" the name refers\r
// to), halving the count; pass 2 folds those results right to left into one tree. This simple change is what\r
// gives the good amortized bounds (O(1) insert/meld, and delete-min in O(log n) amortized). The exact\r
// complexity of decrease-key is famously still open — pairing heaps are conjectured but not proven to match the\r
// Fibonacci heap's O(1) — yet they beat Fibonacci heaps in practice because their constants are tiny and they\r
// have no parent pointers or bookkeeping. This models meld, insert, the two-pass delete-min, and heapsort.\r
// Reference: Fredman, Sedgewick, Sleator & Tarjan, "The pairing heap" (1986).\r
\r
export interface PNode { key: number; children: PNode[] }\r
export type Heap = PNode | null;\r
\r
/** Meld two heaps: the smaller root adopts the larger-rooted tree as its new first child. O(1). */\r
export function meld(a: Heap, b: Heap): Heap {\r
  if (a === null) return b;\r
  if (b === null) return a;\r
  return a.key <= b.key\r
    ? { key: a.key, children: [b, ...a.children] }\r
    : { key: b.key, children: [a, ...b.children] };\r
}\r
\r
export const insert = (h: Heap, key: number): Heap => meld(h, { key, children: [] });\r
export const findMin = (h: Heap): number | null => (h ? h.key : null);\r
\r
/** Two-pass merge of a child forest: pair left-to-right, then fold right-to-left. */\r
export function twoPass(list: PNode[]): Heap {\r
  if (list.length === 0) return null;\r
  const paired: Heap[] = [];\r
  for (let i = 0; i + 1 < list.length; i += 2) paired.push(meld(list[i], list[i + 1])); // pass 1: pairs\r
  if (list.length % 2 === 1) paired.push(list[list.length - 1]);\r
  let acc: Heap = paired[paired.length - 1];\r
  for (let i = paired.length - 2; i >= 0; i--) acc = meld(paired[i], acc);              // pass 2: fold right→left\r
  return acc;\r
}\r
\r
/** Remove and return the minimum; the root's children are recombined by the two-pass merge. */\r
export function deleteMin(h: Heap): { min: number | null; heap: Heap } {\r
  if (h === null) return { min: null, heap: null };\r
  return { min: h.key, heap: twoPass(h.children) };\r
}\r
\r
/** Build a heap by inserting a sequence of keys. */\r
export const fromKeys = (keys: number[]): Heap => keys.reduce<Heap>((h, k) => insert(h, k), null);\r
\r
/** Repeatedly delete-min → the keys in sorted order (heapsort). */\r
export function drain(h: Heap): number[] {\r
  const out: number[] = [];\r
  let cur = h;\r
  while (cur !== null) { const { min, heap } = deleteMin(cur); out.push(min!); cur = heap; }\r
  return out;\r
}\r
\r
/** Verify the heap-order invariant everywhere (every parent <= its children). */\r
export function isHeap(h: Heap): boolean {\r
  if (h === null) return true;\r
  return h.children.every((c) => h.key <= c.key && isHeap(c));\r
}\r
`;export{e as default};