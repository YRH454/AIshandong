var e=`// B+tree — the index structure under almost every relational database and filesystem. Keys\r
// live in sorted leaves linked left-to-right (for fast range scans); internal nodes hold\r
// only separator keys to route a lookup down to the right leaf. The tree stays balanced by\r
// SPLITTING: when a node overflows its capacity, it splits in two and pushes a separator up\r
// to its parent — and when the root splits, the tree grows one level taller. Because every\r
// leaf is at the same depth, every lookup costs the same O(log n). Pure, tested for the\r
// B+tree invariants (balanced, sorted, bounded fan-out).\r
\r
export interface Leaf { kind: 'leaf'; keys: number[] }\r
export interface Internal { kind: 'internal'; keys: number[]; children: Node[] }\r
export type Node = Leaf | Internal;\r
\r
const maxKeys = (order: number) => order - 1; // a node of \`order\` holds ≤ order-1 keys\r
\r
function insertSorted(arr: number[], k: number): void {\r
  let i = arr.length;\r
  while (i > 0 && arr[i - 1] > k) i--;\r
  if (arr[i - 1] === k) return; // ignore duplicates\r
  arr.splice(i, 0, k);\r
}\r
\r
interface Split { sepKey: number; right: Node }\r
\r
function insertRec(node: Node, key: number, order: number): { node: Node; split?: Split } {\r
  if (node.kind === 'leaf') {\r
    const keys = [...node.keys];\r
    insertSorted(keys, key);\r
    if (keys.length <= maxKeys(order)) return { node: { kind: 'leaf', keys } };\r
    // overflow → split: right leaf's first key is COPIED up as the separator\r
    const mid = Math.ceil(keys.length / 2);\r
    const left: Leaf = { kind: 'leaf', keys: keys.slice(0, mid) };\r
    const right: Leaf = { kind: 'leaf', keys: keys.slice(mid) };\r
    return { node: left, split: { sepKey: right.keys[0], right } };\r
  }\r
  // internal: route to the child, then absorb any split it returns\r
  let ci = node.keys.length;\r
  for (let i = 0; i < node.keys.length; i++) if (key < node.keys[i]) { ci = i; break; }\r
  const res = insertRec(node.children[ci], key, order);\r
  const keys = [...node.keys];\r
  const children = [...node.children];\r
  children[ci] = res.node;\r
  if (!res.split) return { node: { kind: 'internal', keys, children } };\r
  keys.splice(ci, 0, res.split.sepKey);\r
  children.splice(ci + 1, 0, res.split.right);\r
  if (keys.length <= maxKeys(order)) return { node: { kind: 'internal', keys, children } };\r
  // internal overflow → split: the middle separator MOVES up (not copied)\r
  const mid = Math.floor(keys.length / 2);\r
  const sepKey = keys[mid];\r
  const left: Internal = { kind: 'internal', keys: keys.slice(0, mid), children: children.slice(0, mid + 1) };\r
  const right: Internal = { kind: 'internal', keys: keys.slice(mid + 1), children: children.slice(mid + 1) };\r
  return { node: left, split: { sepKey, right } };\r
}\r
\r
export function insert(root: Node, key: number, order: number): Node {\r
  const res = insertRec(root, key, order);\r
  if (!res.split) return res.node;\r
  return { kind: 'internal', keys: [res.split.sepKey], children: [res.node, res.split.right] };\r
}\r
\r
export const emptyTree = (): Node => ({ kind: 'leaf', keys: [] });\r
export const build = (keys: number[], order: number): Node => keys.reduce((t, k) => insert(t, k, order), emptyTree());\r
\r
/** All keys in order, read straight off the leaves left to right. */\r
export function leafScan(node: Node): number[] {\r
  if (node.kind === 'leaf') return [...node.keys];\r
  return node.children.flatMap(leafScan);\r
}\r
\r
export function height(node: Node): number {\r
  return node.kind === 'leaf' ? 1 : 1 + height(node.children[0]);\r
}\r
\r
/** Depths at which leaves appear — a B+tree is balanced iff this set has size 1. */\r
export function leafDepths(node: Node, d = 1, acc = new Set<number>()): Set<number> {\r
  if (node.kind === 'leaf') acc.add(d);\r
  else for (const c of node.children) leafDepths(c, d + 1, acc);\r
  return acc;\r
}\r
\r
// ---- deletion -------------------------------------------------------------------------------\r
// Deleting is the mirror of inserting. Remove the key from its leaf; if that leaves the node\r
// below its minimum occupancy it UNDERFLOWS, and we repair it the same two ways insertion grows:\r
// BORROW one key from an adjacent sibling that has a spare (rotating through the parent separator),\r
// or MERGE with a sibling when neither can spare one — pulling the separator down for internal\r
// nodes, just dropping it for leaves (leaves already hold every key). A merge can cascade an\r
// underflow up to the parent; if the root collapses to a single child, the tree shrinks a level.\r
\r
const minLeafKeys = (order: number) => Math.floor(order / 2); // ≈ half full (ceil((order-1)/2))\r
const minInternalKeys = (order: number) => Math.ceil(order / 2) - 1; // ≥ ceil(order/2) children\r
const underflows = (n: Node, order: number) => n.keys.length < (n.kind === 'leaf' ? minLeafKeys(order) : minInternalKeys(order));\r
\r
function cloneNode(n: Node): Node {\r
  return n.kind === 'leaf' ? { kind: 'leaf', keys: [...n.keys] } : { kind: 'internal', keys: [...n.keys], children: n.children.map(cloneNode) };\r
}\r
\r
function borrowLeft(parent: Internal, ci: number): void {\r
  const child = parent.children[ci], left = parent.children[ci - 1];\r
  if (child.kind === 'leaf' && left.kind === 'leaf') {\r
    child.keys.unshift(left.keys.pop()!);\r
    parent.keys[ci - 1] = child.keys[0]; // separator = child's new first key\r
  } else if (child.kind === 'internal' && left.kind === 'internal') {\r
    child.keys.unshift(parent.keys[ci - 1]); // rotate the separator down\r
    child.children.unshift(left.children.pop()!);\r
    parent.keys[ci - 1] = left.keys.pop()!; // and the sibling's last key up\r
  }\r
}\r
\r
function borrowRight(parent: Internal, ci: number): void {\r
  const child = parent.children[ci], right = parent.children[ci + 1];\r
  if (child.kind === 'leaf' && right.kind === 'leaf') {\r
    child.keys.push(right.keys.shift()!);\r
    parent.keys[ci] = right.keys[0]; // separator = right sibling's new first key\r
  } else if (child.kind === 'internal' && right.kind === 'internal') {\r
    child.keys.push(parent.keys[ci]);\r
    child.children.push(right.children.shift()!);\r
    parent.keys[ci] = right.keys.shift()!;\r
  }\r
}\r
\r
/** Merge children[idx] and children[idx+1] into one node, consuming the separator between them. */\r
function mergeAt(parent: Internal, idx: number): void {\r
  const a = parent.children[idx], b = parent.children[idx + 1];\r
  if (a.kind === 'leaf' && b.kind === 'leaf') {\r
    a.keys = [...a.keys, ...b.keys]; // leaves: separator just disappears\r
  } else if (a.kind === 'internal' && b.kind === 'internal') {\r
    a.keys = [...a.keys, parent.keys[idx], ...b.keys]; // internal: pull the separator down\r
    a.children = [...a.children, ...b.children];\r
  }\r
  parent.keys.splice(idx, 1);\r
  parent.children.splice(idx + 1, 1);\r
}\r
\r
function fixUnderflow(parent: Internal, ci: number, order: number): void {\r
  const left = ci > 0 ? parent.children[ci - 1] : null;\r
  const right = ci < parent.children.length - 1 ? parent.children[ci + 1] : null;\r
  const min = parent.children[ci].kind === 'leaf' ? minLeafKeys(order) : minInternalKeys(order);\r
  if (left && left.keys.length > min) return borrowLeft(parent, ci);\r
  if (right && right.keys.length > min) return borrowRight(parent, ci);\r
  if (left) return mergeAt(parent, ci - 1); // merge child into its left sibling\r
  return mergeAt(parent, ci); //                merge right sibling into child\r
}\r
\r
function deleteRec(node: Node, key: number, order: number): void {\r
  if (node.kind === 'leaf') {\r
    const i = node.keys.indexOf(key);\r
    if (i >= 0) node.keys.splice(i, 1);\r
    return;\r
  }\r
  let ci = node.keys.length;\r
  for (let i = 0; i < node.keys.length; i++) if (key < node.keys[i]) { ci = i; break; }\r
  deleteRec(node.children[ci], key, order);\r
  if (underflows(node.children[ci], order)) fixUnderflow(node, ci, order);\r
}\r
\r
/** Remove a key, rebalancing by borrow/merge. Returns the new root (collapsed a level if needed). */\r
export function remove(root: Node, key: number, order: number): Node {\r
  const r = cloneNode(root);\r
  deleteRec(r, key, order);\r
  if (r.kind === 'internal' && r.keys.length === 0) return r.children[0]; // root shrank to one child\r
  return r;\r
}\r
`;export{e as default};