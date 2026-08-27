var e=`// AVL tree (Adelson-Velsky & Landis, 1962) — a binary search tree that keeps itself balanced\r
// after every insert, so search/insert/delete stay O(log n) instead of degrading to a linked\r
// list on sorted input. Each node tracks its height; the BALANCE FACTOR (left height − right\r
// height) must stay in {−1, 0, +1}. When an insert pushes it to ±2, a ROTATION restores\r
// balance — four cases (LL, RR, LR, RL) depending on where the new node landed. Rotations are\r
// local pointer rewires that preserve the in-order (sorted) sequence. Pure, tested for the BST\r
// + balance invariants and the canonical rotation cases.\r
\r
export interface Node { key: number; height: number; left: Node | null; right: Node | null }\r
\r
const h = (n: Node | null): number => (n ? n.height : 0);\r
const bf = (n: Node | null): number => (n ? h(n.left) - h(n.right) : 0);\r
const fix = (n: Node): Node => { n.height = 1 + Math.max(h(n.left), h(n.right)); return n; };\r
const node = (key: number): Node => ({ key, height: 1, left: null, right: null });\r
\r
function rotateRight(y: Node): Node { const x = y.left!; y.left = x.right; x.right = y; fix(y); return fix(x); }\r
function rotateLeft(x: Node): Node { const y = x.right!; x.right = y.left; y.left = x; fix(x); return fix(y); }\r
\r
export function insert(root: Node | null, key: number): Node {\r
  if (!root) return node(key);\r
  if (key < root.key) root.left = insert(root.left, key);\r
  else if (key > root.key) root.right = insert(root.right, key);\r
  else return root; // ignore duplicates\r
  fix(root);\r
\r
  const balance = bf(root);\r
  if (balance > 1 && key < root.left!.key) return rotateRight(root);              // LL\r
  if (balance < -1 && key > root.right!.key) return rotateLeft(root);             // RR\r
  if (balance > 1 && key > root.left!.key) { root.left = rotateLeft(root.left!); return rotateRight(root); }   // LR\r
  if (balance < -1 && key < root.right!.key) { root.right = rotateRight(root.right!); return rotateLeft(root); } // RL\r
  return root;\r
}\r
\r
export const build = (keys: number[]): Node | null => keys.reduce<Node | null>((t, k) => insert(t, k), null);\r
\r
/** In-order traversal — yields the keys in sorted order (the BST invariant). */\r
export function inorder(n: Node | null, out: number[] = []): number[] {\r
  if (n) { inorder(n.left, out); out.push(n.key); inorder(n.right, out); }\r
  return out;\r
}\r
\r
export const height = h;\r
export const balanceFactor = bf;\r
\r
/** Is this a valid AVL tree (BST order + every balance factor in {−1,0,+1})? */\r
export function isAvl(n: Node | null, lo = -Infinity, hi = Infinity): boolean {\r
  if (!n) return true;\r
  if (n.key <= lo || n.key >= hi) return false;            // BST order\r
  if (Math.abs(bf(n)) > 1) return false;                   // balance\r
  if (n.height !== 1 + Math.max(h(n.left), h(n.right))) return false; // height cached correctly\r
  return isAvl(n.left, lo, n.key) && isAvl(n.right, n.key, hi);\r
}\r
`;export{e as default};