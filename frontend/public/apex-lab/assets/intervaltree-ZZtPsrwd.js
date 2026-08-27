var e=`// Interval tree — a data structure that answers "which of these intervals overlap the range [q1, q2]?" in\r
// O(log n + k) instead of scanning all n of them. Think overlapping calendar events, genome features on a\r
// chromosome, firewall rules over port ranges, or "which ads are live at this timestamp." It's a binary search\r
// tree keyed by each interval's LOW endpoint, AUGMENTED so every node also stores the maximum HIGH endpoint\r
// anywhere in its subtree. That one extra number is the whole trick: when searching, if a subtree's max-high\r
// is less than the query's low, nothing in that entire subtree can reach the query, so you prune it and never\r
// look inside. That pruning is what turns a linear scan into a logarithmic descent (plus the k matches you\r
// actually report). Insertions keep the max updated on the way down. Reference: CLRS, "Introduction to\r
// Algorithms," interval trees.\r
\r
export interface Node { lo: number; hi: number; max: number; left: Node | null; right: Node | null }\r
export type Interval = [number, number];\r
\r
const mk = (lo: number, hi: number): Node => ({ lo, hi, max: hi, left: null, right: null });\r
const maxOf = (n: Node | null): number => (n ? n.max : -Infinity);\r
\r
/** Insert [lo, hi], keyed by lo, updating each node's subtree-max on the way down. */\r
export function insert(root: Node | null, lo: number, hi: number): Node {\r
  if (!root) return mk(lo, hi);\r
  if (lo < root.lo) root.left = insert(root.left, lo, hi);\r
  else root.right = insert(root.right, lo, hi);\r
  root.max = Math.max(root.hi, maxOf(root.left), maxOf(root.right));\r
  return root;\r
}\r
\r
export const build = (intervals: Interval[]): Node | null => intervals.reduce<Node | null>((r, [lo, hi]) => insert(r, lo, hi), null);\r
\r
const overlaps = (aLo: number, aHi: number, bLo: number, bHi: number) => aLo <= bHi && bLo <= aHi;\r
\r
/** All intervals overlapping [qLo, qHi], pruning subtrees whose max-high can't reach the query.\r
 *  \`visited\` counts nodes examined — compare it to n to see the pruning. */\r
export function search(root: Node | null, qLo: number, qHi: number): { hits: Interval[]; visited: number } {\r
  const hits: Interval[] = [];\r
  let visited = 0;\r
  const go = (n: Node | null) => {\r
    if (!n) return;\r
    visited++;\r
    if (maxOf(n) < qLo) return;                       // prune: nothing in this subtree reaches the query\r
    go(n.left);\r
    if (overlaps(n.lo, n.hi, qLo, qHi)) hits.push([n.lo, n.hi]);\r
    if (qHi >= n.lo) go(n.right);                     // right subtree only helps if the query extends past n.lo\r
  };\r
  go(root);\r
  hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);\r
  return { hits, visited };\r
}\r
\r
/** Brute-force overlap check — the ground truth. */\r
export function brute(intervals: Interval[], qLo: number, qHi: number): Interval[] {\r
  return intervals.filter(([lo, hi]) => overlaps(lo, hi, qLo, qHi)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);\r
}\r
\r
export function inorder(root: Node | null): Node[] {\r
  const out: Node[] = [];\r
  const go = (n: Node | null) => { if (!n) return; go(n.left); out.push(n); go(n.right); };\r
  go(root);\r
  return out;\r
}\r
`;export{e as default};