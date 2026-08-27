var e=`// MLS / TreeKEM — how a group of thousands keeps one shared key fresh in O(log n) instead of O(n). Members are the\r
// leaves of a binary ratchet tree; each member knows the secrets on the path from its leaf up to the root, and the\r
// group key sits at the root. When a member updates its key (or joins/leaves), only the nodes on its DIRECT PATH (leaf\r
// to root) are re-keyed, and the fresh secret for each is encrypted to the SIBLING subtree (the copath) so every other\r
// member can recompute the new root. That's log n re-keys and log n encryptions per change, versus n-1 if you re-keyed\r
// pairwise. This computes the exact tree structure and cost; the HPKE encryptions themselves are out of scope.\r
\r
export interface Node { level: number; index: number }\r
\r
const levelsFor = (n: number) => Math.log2(n); // n members = 2^levels leaves; root sits at \`levels\`\r
\r
// The internal nodes from a leaf up to the root (the nodes whose secrets get replaced on an update).\r
export function directPath(leaf: number, n: number): Node[] {\r
  const levels = levelsFor(n);\r
  const path: Node[] = [];\r
  let idx = leaf;\r
  for (let level = 1; level <= levels; level++) {\r
    idx = idx >> 1;\r
    path.push({ level, index: idx });\r
  }\r
  return path;\r
}\r
\r
// The sibling of each node on the path leaf→root — the subtree that must be sent the new node secret. The first entry\r
// is the leaf's sibling leaf; the rest are internal siblings.\r
export function copath(leaf: number, n: number): Node[] {\r
  const levels = levelsFor(n);\r
  const co: Node[] = [];\r
  let idx = leaf;\r
  for (let level = 0; level < levels; level++) {\r
    co.push({ level, index: idx ^ 1 }); // sibling at this level\r
    idx = idx >> 1;\r
  }\r
  return co;\r
}\r
\r
export interface Cost { members: number; reKeyed: number; encryptions: number; naivePairwise: number }\r
export function updateCost(n: number): Cost {\r
  const levels = levelsFor(n);\r
  return { members: n, reKeyed: levels + 1, encryptions: levels, naivePairwise: n - 1 };\r
}\r
\r
// After member \`removed\` is evicted, can \`member\` still derive the new root secret? Everyone in the group can; the\r
// removed member's leaf is blanked and the path re-keyed, so it cannot.\r
export function canDeriveRoot(member: number, removed: number | null): boolean {\r
  return member !== removed;\r
}\r
`;export{e as default};