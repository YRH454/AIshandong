var e=`// Splay tree — a binary search tree that REBALANCES ITSELF around whatever you just touched. Every time you\r
// look up (or insert) a key, the tree rotates that node all the way up to the root by a sequence of\r
// zig / zig-zig / zig-zag rotations. No balance factors, no colors, no height fields — just "move what you\r
// touched to the top." The payoff is temporal locality for free: a key you access often (or just accessed)\r
// sits near the root and is found in O(1); the whole structure adapts to your access pattern. Individual\r
// operations can be O(n) in the worst case, but the AMORTIZED cost over any sequence is O(log n), and on\r
// skewed workloads it beats a balanced tree. Used in some caches, the Linux kernel (vma lookups historically),\r
// and network routing tables. Reference: Sleator & Tarjan, "Self-Adjusting Binary Search Trees" (1985).\r
\r
export interface SNode { key: number; left: SNode | null; right: SNode | null }\r
\r
const rotR = (t: SNode): SNode => { const l = t.left!; t.left = l.right; l.right = t; return l; };\r
const rotL = (t: SNode): SNode => { const r = t.right!; t.right = r.left; r.left = t; return r; };\r
\r
/** Top-down-ish recursive splay: bring \`key\` (or the last node on its search path) to the root of \`t\`. */\r
export function splay(t: SNode | null, key: number): SNode | null {\r
  if (!t || t.key === key) return t;\r
  if (key < t.key) {\r
    if (!t.left) return t;                                   // key not present, stop at t\r
    if (key < t.left.key) { t.left.left = splay(t.left.left, key); t = rotR(t); }        // zig-zig\r
    else if (key > t.left.key) { t.left.right = splay(t.left.right, key); if (t.left.right) t.left = rotL(t.left); } // zig-zag\r
    return t.left ? rotR(t) : t;                             // zig\r
  } else {\r
    if (!t.right) return t;\r
    if (key > t.right.key) { t.right.right = splay(t.right.right, key); t = rotL(t); }    // zig-zig\r
    else if (key < t.right.key) { t.right.left = splay(t.right.left, key); if (t.right.left) t.right = rotR(t.right); } // zig-zag\r
    return t.right ? rotL(t) : t;                            // zig\r
  }\r
}\r
\r
export class SplayTree {\r
  root: SNode | null = null;\r
\r
  /** Insert a key; the new node becomes the root (splay-based insert). */\r
  insert(key: number): void {\r
    if (!this.root) { this.root = { key, left: null, right: null }; return; }\r
    this.root = splay(this.root, key)!;\r
    if (this.root.key === key) return; // already present\r
    const n: SNode = { key, left: null, right: null };\r
    if (key < this.root.key) { n.right = this.root; n.left = this.root.left; this.root.left = null; }\r
    else { n.left = this.root; n.right = this.root.right; this.root.right = null; }\r
    this.root = n;\r
  }\r
\r
  /** Look up a key, splaying it (or its search-path end) to the root. Returns whether it was found and the\r
   *  access COST — how deep the key was before splaying (this is what a repeat access saves). */\r
  find(key: number): { found: boolean; cost: number } {\r
    const cost = this.depthOf(key); // depth on the search path before we move it\r
    this.root = splay(this.root, key);\r
    return { found: this.root?.key === key, cost: cost < 0 ? this.searchDepth(key) : cost };\r
  }\r
\r
  /** Depth of a key currently in the tree (0 = root), or -1 if absent. */\r
  depthOf(key: number): number {\r
    let n = this.root, d = 0;\r
    while (n) { if (key === n.key) return d; n = key < n.key ? n.left : n.right; d++; }\r
    return -1;\r
  }\r
  /** Comparisons a search for an absent key would make (its search-path length). */\r
  private searchDepth(key: number): number {\r
    let n = this.root, d = 0;\r
    while (n) { n = key < n.key ? n.left : n.right; d++; }\r
    return d;\r
  }\r
\r
  /** In-order keys — must always be sorted (the BST invariant), no matter how much splaying happened. */\r
  inorder(): number[] {\r
    const out: number[] = [];\r
    const go = (n: SNode | null) => { if (!n) return; go(n.left); out.push(n.key); go(n.right); };\r
    go(this.root);\r
    return out;\r
  }\r
\r
  rootKey(): number | null { return this.root?.key ?? null; }\r
  height(): number {\r
    const h = (n: SNode | null): number => (n ? 1 + Math.max(h(n.left), h(n.right)) : 0);\r
    return h(this.root);\r
  }\r
}\r
`;export{e as default};