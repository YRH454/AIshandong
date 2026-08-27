var e=`// The Cartesian tree — a binary tree built from a sequence that is, at the same time, a binary SEARCH tree on\r
// array position and a min-HEAP on value. From an array A, the root is the position of the minimum element; its\r
// left subtree is the Cartesian tree of everything to the left of that minimum, its right subtree the tree of\r
// everything to the right. Recurse. Two beautiful facts fall out. First, an in-order traversal returns the\r
// original array (it's a BST by index), while every parent's value is <= its children's (it's a heap by value).\r
// Second — and this is the famous one — the LOWEST COMMON ANCESTOR of positions i and j in the Cartesian tree\r
// is exactly the position of the MINIMUM of A[i..j]. That means the Range-Minimum-Query problem and the\r
// Lowest-Common-Ancestor problem are the same problem wearing different clothes: solve one and you've solved the\r
// other, and this equivalence is the key that unlocks O(n) preprocessing / O(1) query RMQ (via the ±1 RMQ on an\r
// Euler tour). The tree also builds in O(n) total with a single stack pass — each element pops the stack while\r
// the top is larger (those become its left subtree), then attaches under whatever remains — so every element is\r
// pushed and popped at most once. Cartesian trees also underlie the treap (a Cartesian tree on (key, random\r
// priority) pairs is a balanced BST) and pattern-matching indexes. This models both constructions, the\r
// heap/BST invariants, and the RMQ=LCA equivalence. Reference: Vuillemin (1980); Gabow, Bentley & Tarjan (1984).\r
\r
export interface CNode { i: number; val: number; left: number; right: number; parent: number }\r
export interface Tree { nodes: CNode[]; root: number }\r
\r
/** Build the min-Cartesian-tree of \`a\` in O(n) with a single monotonic-stack pass. */\r
export function build(a: number[]): Tree {\r
  const nodes: CNode[] = a.map((val, i) => ({ i, val, left: -1, right: -1, parent: -1 }));\r
  const stack: number[] = []; // indices, values increasing from bottom to top\r
  for (let i = 0; i < a.length; i++) {\r
    let last = -1;\r
    while (stack.length && a[stack[stack.length - 1]] > a[i]) last = stack.pop()!;\r
    if (last !== -1) { nodes[i].left = last; nodes[last].parent = i; }        // popped subtree hangs left\r
    if (stack.length) { const t = stack[stack.length - 1]; nodes[t].right = i; nodes[i].parent = t; }\r
    stack.push(i);\r
  }\r
  return { nodes, root: stack.length ? stack[0] : -1 };\r
}\r
\r
/** The equivalent recursive definition (root = argmin of the range), for cross-checking. */\r
export function buildRecursive(a: number[]): Tree {\r
  const nodes: CNode[] = a.map((val, i) => ({ i, val, left: -1, right: -1, parent: -1 }));\r
  const rec = (lo: number, hi: number, parent: number): number => {\r
    if (lo > hi) return -1;\r
    let m = lo;\r
    for (let k = lo + 1; k <= hi; k++) if (a[k] < a[m]) m = k;   // left-most minimum\r
    nodes[m].parent = parent;\r
    nodes[m].left = rec(lo, m - 1, m);\r
    nodes[m].right = rec(m + 1, hi, m);\r
    return m;\r
  };\r
  return { nodes, root: rec(0, a.length - 1, -1) };\r
}\r
\r
/** In-order traversal — returns the node indices in array order (should be 0..n-1). */\r
export function inorder(t: Tree): number[] {\r
  const out: number[] = [];\r
  const visit = (x: number) => { if (x === -1) return; visit(t.nodes[x].left); out.push(x); visit(t.nodes[x].right); };\r
  visit(t.root);\r
  return out;\r
}\r
\r
/** Depth of every node from the root. */\r
function depths(t: Tree): number[] {\r
  const d = new Array(t.nodes.length).fill(0);\r
  const visit = (x: number, dep: number) => { if (x === -1) return; d[x] = dep; visit(t.nodes[x].left, dep + 1); visit(t.nodes[x].right, dep + 1); };\r
  visit(t.root, 0);\r
  return d;\r
}\r
\r
/** Lowest common ancestor of positions i and j (by walking up parent pointers). */\r
export function lca(t: Tree, i: number, j: number): number {\r
  const d = depths(t);\r
  let a = i, b = j;\r
  while (d[a] > d[b]) a = t.nodes[a].parent;\r
  while (d[b] > d[a]) b = t.nodes[b].parent;\r
  while (a !== b) { a = t.nodes[a].parent; b = t.nodes[b].parent; }\r
  return a;\r
}\r
\r
/** Range minimum of a[i..j] via the LCA (the equivalence); returns the position of the minimum. */\r
export const rmqPos = (t: Tree, i: number, j: number): number => lca(t, i, j);\r
`;export{e as default};