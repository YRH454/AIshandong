var e=`// Skip list (Pugh, 1990) — a sorted structure that gives B-tree-like O(log n) search with\r
// nothing but linked lists and coin flips, which is why it backs Redis sorted sets and many\r
// LSM memtables. Level 0 is an ordinary sorted linked list holding every key; each higher\r
// level is a sparser "express lane" — a node is promoted to the next level up with\r
// probability ½, so the lanes thin out geometrically. A search rides the highest lane\r
// rightward until the next key would overshoot, then drops down a level, repeating — so it\r
// skips over most nodes. Heights are injected here (instead of random) so the structure is\r
// deterministic and testable.\r
\r
export interface SkipNode { key: number; next: (SkipNode | null)[] }\r
export interface SkipList { head: (SkipNode | null)[]; maxLevel: number }\r
\r
export const create = (maxLevel = 4): SkipList => ({ head: new Array(maxLevel).fill(null), maxLevel });\r
\r
/** Insert \`key\` so it participates in levels 0..height-1. */\r
export function insert(list: SkipList, key: number, height: number): void {\r
  height = Math.max(1, Math.min(height, list.maxLevel)); // always at least level 0, never above maxLevel\r
  const update: (SkipNode | null)[] = new Array(list.maxLevel).fill(null); // predecessor at each level\r
  // descend from the top, recording where we drop down\r
  let node: SkipNode | null = null;\r
  for (let level = list.maxLevel - 1; level >= 0; level--) {\r
    while (true) {\r
      const nxt: SkipNode | null = node ? node.next[level] : list.head[level];\r
      if (nxt && nxt.key < key) node = nxt; else break;\r
    }\r
    update[level] = node;\r
  }\r
  const fresh: SkipNode = { key, next: new Array(height).fill(null) };\r
  for (let l = 0; l < height; l++) {\r
    const pred = update[l];\r
    if (pred) { fresh.next[l] = pred.next[l]; pred.next[l] = fresh; }\r
    else { fresh.next[l] = list.head[l]; list.head[l] = fresh; }\r
  }\r
}\r
\r
/** Remove \`key\` from every level it participates in. Returns whether it was present. */\r
export function remove(list: SkipList, key: number): boolean {\r
  const update: (SkipNode | null)[] = new Array(list.maxLevel).fill(null);\r
  let node: SkipNode | null = null;\r
  for (let level = list.maxLevel - 1; level >= 0; level--) {\r
    while (true) {\r
      const nxt: SkipNode | null = node ? node.next[level] : list.head[level];\r
      if (nxt && nxt.key < key) node = nxt; else break;\r
    }\r
    update[level] = node;\r
  }\r
  const target = node ? node.next[0] : list.head[0];\r
  if (!target || target.key !== key) return false; // not present\r
  for (let l = 0; l < list.maxLevel; l++) {\r
    const pred = update[l];\r
    if ((pred ? pred.next[l] : list.head[l]) === target) { // target is on this level → unlink it\r
      if (pred) pred.next[l] = target.next[l]; else list.head[l] = target.next[l];\r
    }\r
  }\r
  return true;\r
}\r
\r
export interface SearchResult { found: boolean; visited: number[]; hops: number }\r
\r
/** Search for \`key\`, recording the keys visited so the express-lane skipping is visible. */\r
export function search(list: SkipList, key: number): SearchResult {\r
  const visited: number[] = [];\r
  let node: SkipNode | null = null;\r
  for (let level = list.maxLevel - 1; level >= 0; level--) {\r
    while (true) {\r
      const nxt: SkipNode | null = node ? node.next[level] : list.head[level];\r
      if (nxt && nxt.key < key) { node = nxt; visited.push(node.key); } else break;\r
    }\r
  }\r
  const candidate = node ? node.next[0] : list.head[0];\r
  if (candidate && candidate.key === key) visited.push(candidate.key);\r
  return { found: !!candidate && candidate.key === key, visited, hops: visited.length };\r
}\r
\r
/** Level-0 keys in order (the complete sorted sequence). */\r
export function toArray(list: SkipList): number[] {\r
  const out: number[] = [];\r
  for (let n = list.head[0]; n; n = n.next[0]) out.push(n.key);\r
  return out;\r
}\r
\r
/** How many levels each key reaches (for display), keyed by key. */\r
export function heights(list: SkipList): Record<number, number> {\r
  const h: Record<number, number> = {};\r
  for (let lvl = 0; lvl < list.maxLevel; lvl++) for (let n = list.head[lvl]; n; n = n.next[lvl]) h[n.key] = Math.max(h[n.key] ?? 0, lvl + 1);\r
  return h;\r
}\r
`;export{e as default};