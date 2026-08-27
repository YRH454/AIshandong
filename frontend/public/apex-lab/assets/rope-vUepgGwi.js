var e=`// The rope — how a text editor holds a huge document so that inserting a character in the middle isn't O(n).\r
// A flat string (or array) is great for reads but brutal for edits: inserting one byte at the front of a 100 MB\r
// file shifts all 100 MB. A rope stores the text as the leaves of a balanced binary tree; each internal node\r
// caches the total length of its LEFT subtree (its "weight"). That single number turns navigation into a tree\r
// walk: to find character i, compare i to the weight — go left if smaller, else go right subtracting the weight —\r
// so index, split, insert, delete, and concat are all O(log n) instead of O(n). Concatenation is nearly free\r
// (make a new root over the two ropes), and because nodes are immutable and shared, every edit can keep the old\r
// version alive for free undo/redo. The catch is balance — naive concatenation can grow a lopsided tree, so real\r
// ropes rebalance (or use a balanced variant); this model keeps the operations exact and leaves balancing to the\r
// prose. Ropes (and their cousins the gap buffer and piece table) are why editors open gigabyte files instantly\r
// and why splicing text stays fast no matter the size. This models index/split/concat/insert/delete against a\r
// reference string. Reference: Boehm, Atkinson & Plass, "Ropes: an Alternative to Strings" (1995).\r
\r
export type Rope = { text: string } | { left: Rope; right: Rope; weight: number };\r
\r
const isLeaf = (r: Rope): r is { text: string } => 'text' in r;\r
export const leaf = (text: string): Rope => ({ text });\r
\r
export function length(r: Rope): number { return isLeaf(r) ? r.text.length : r.weight + length(r.right); }\r
\r
/** Concatenate two ropes in O(1): a new root whose left-weight is |a|. */\r
export const concat = (a: Rope, b: Rope): Rope => ({ left: a, right: b, weight: length(a) });\r
\r
/** The character at position i — a tree walk guided by the weights. */\r
export function index(r: Rope, i: number): string {\r
  if (isLeaf(r)) return r.text[i];\r
  return i < r.weight ? index(r.left, i) : index(r.right, i - r.weight);\r
}\r
\r
/** Split the rope into [first i characters, the rest]. */\r
export function split(r: Rope, i: number): [Rope, Rope] {\r
  if (isLeaf(r)) return [leaf(r.text.slice(0, i)), leaf(r.text.slice(i))];\r
  if (i < r.weight) { const [ll, lr] = split(r.left, i); return [ll, concat(lr, r.right)]; }\r
  if (i > r.weight) { const [rl, rr] = split(r.right, i - r.weight); return [concat(r.left, rl), rr]; }\r
  return [r.left, r.right]; // i === weight: clean cut at the node boundary\r
}\r
\r
/** Insert string s at position i (split + graft + join) — O(log n), old rope untouched. */\r
export function insert(r: Rope, i: number, s: string): Rope {\r
  const [l, right] = split(r, i);\r
  return concat(concat(l, leaf(s)), right);\r
}\r
\r
/** Delete characters [i, j). */\r
export function del(r: Rope, i: number, j: number): Rope {\r
  const [l, rest] = split(r, i);\r
  const [, right] = split(rest, j - i);\r
  return concat(l, right);\r
}\r
\r
/** Reconstruct the full string (in-order leaf concatenation). */\r
export function toStr(r: Rope): string { return isLeaf(r) ? r.text : toStr(r.left) + toStr(r.right); }\r
\r
/** Tree depth — the cost of an operation; a balanced rope keeps this ~log(n). */\r
export function depth(r: Rope): number { return isLeaf(r) ? 0 : 1 + Math.max(depth(r.left), depth(r.right)); }\r
\r
/** Build a rope from chunks (a balanced merge, so depth ~ log(chunks)). */\r
export function fromChunks(chunks: string[]): Rope {\r
  if (chunks.length === 0) return leaf('');\r
  let level: Rope[] = chunks.map(leaf);\r
  while (level.length > 1) {\r
    const next: Rope[] = [];\r
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? concat(level[i], level[i + 1]) : level[i]);\r
    level = next;\r
  }\r
  return level[0];\r
}\r
`;export{e as default};