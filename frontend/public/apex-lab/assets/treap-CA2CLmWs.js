var e=`// Treap ("tree" + "heap") — a binary search tree that stays balanced by ACCIDENT instead of by rules. A plain\r
// BST degrades to a linked list if you insert sorted keys; AVL and red-black trees fix that with fiddly\r
// rotation bookkeeping. A treap takes a lazier, beautiful route: give every node a random PRIORITY, and\r
// maintain two invariants at once — BST order on the keys (left < node < right) AND heap order on the\r
// priorities (a parent's priority beats its children's). There is exactly one tree shape that satisfies both\r
// for a given set of (key, priority) pairs, and because the priorities are random, that shape is — in\r
// expectation — a balanced tree of height O(log n). No balance factors, no color bits: insert as a normal BST\r
// leaf, then rotate it upward while its priority is bigger than its parent's, and stop. A lovely bonus when the\r
// priority is derived from a HASH of the key: the tree's shape depends only on the SET of keys, not the order\r
// they were inserted — insert {1,2,3} or {3,1,2} and you get the identical tree (great for reproducibility and\r
// for merging). Treaps also split and merge by key in O(log n), which is why they're a favourite for\r
// order-statistics and rope-like structures. Reference: Seidel & Aragon, "Randomized Search Trees" (1996).\r
\r
export interface TNode { key: number; prio: number; left: TNode | null; right: TNode | null }\r
\r
/** Deterministic priority from the key (a good 32-bit mix) — makes the treap shape set-defined, not order-defined. */\r
export function priority(key: number): number {\r
  let h = Math.imul(key ^ 0x9e3779b9, 0x85ebca6b) >>> 0;\r
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;\r
  return (h ^ (h >>> 16)) >>> 0;\r
}\r
\r
const node = (key: number): TNode => ({ key, prio: priority(key), left: null, right: null });\r
const rotR = (t: TNode): TNode => { const l = t.left!; t.left = l.right; l.right = t; return l; };\r
const rotL = (t: TNode): TNode => { const r = t.right!; t.right = r.left; r.left = t; return r; };\r
\r
/** Insert a key: BST insert, then bubble it up by rotation while its priority exceeds the parent's (max-heap). */\r
export function insert(root: TNode | null, key: number): TNode {\r
  if (!root) return node(key);\r
  if (key === root.key) return root; // set semantics: no duplicates\r
  if (key < root.key) { root.left = insert(root.left, key); if (root.left.prio > root.prio) root = rotR(root); }\r
  else { root.right = insert(root.right, key); if (root.right.prio > root.prio) root = rotL(root); }\r
  return root;\r
}\r
\r
export const build = (keys: number[]): TNode | null => keys.reduce<TNode | null>((r, k) => insert(r, k), null);\r
\r
export function has(root: TNode | null, key: number): boolean {\r
  let n = root;\r
  while (n) { if (key === n.key) return true; n = key < n.key ? n.left : n.right; }\r
  return false;\r
}\r
\r
export function inorder(root: TNode | null): number[] {\r
  const out: number[] = [];\r
  const go = (n: TNode | null) => { if (!n) return; go(n.left); out.push(n.key); go(n.right); };\r
  go(root);\r
  return out;\r
}\r
\r
export function height(root: TNode | null): number {\r
  return root ? 1 + Math.max(height(root.left), height(root.right)) : 0;\r
}\r
\r
/** True iff BOTH invariants hold: BST order on keys and max-heap order on priorities. */\r
export function valid(root: TNode | null): boolean {\r
  const check = (n: TNode | null, lo: number, hi: number): boolean => {\r
    if (!n) return true;\r
    if (n.key <= lo || n.key >= hi) return false;                       // BST\r
    if ((n.left && n.left.prio > n.prio) || (n.right && n.right.prio > n.prio)) return false; // heap\r
    return check(n.left, lo, n.key) && check(n.right, n.key, hi);\r
  };\r
  return check(root, -Infinity, Infinity);\r
}\r
`;export{e as default};