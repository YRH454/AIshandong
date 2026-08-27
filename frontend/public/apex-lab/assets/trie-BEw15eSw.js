var e=`// Trie (prefix tree) — a tree keyed by the characters of a string, so every word that\r
// shares a prefix shares a path from the root. That makes prefix questions trivial:\r
// autocomplete is "walk to the prefix node, then list every word below it," and lookup is\r
// O(length of key) regardless of how many keys are stored. The same structure, keyed by the\r
// bits of an address, does longest-prefix-match in IP routing tables. Pure, tested.\r
\r
export interface TrieNode { children: Record<string, TrieNode>; end: boolean }\r
\r
export const create = (): TrieNode => ({ children: {}, end: false });\r
\r
export function insert(root: TrieNode, word: string): void {\r
  let node = root;\r
  for (const ch of word) {\r
    node = node.children[ch] ?? (node.children[ch] = create());\r
  }\r
  node.end = true;\r
}\r
\r
/** Walk to the node at the end of \`path\`, or null if the path isn't present. */\r
function descend(root: TrieNode, path: string): TrieNode | null {\r
  let node: TrieNode = root;\r
  for (const ch of path) {\r
    const next = node.children[ch];\r
    if (!next) return null;\r
    node = next;\r
  }\r
  return node;\r
}\r
\r
/** Is \`word\` a complete stored key? */\r
export function has(root: TrieNode, word: string): boolean {\r
  const n = descend(root, word);\r
  return !!n && n.end;\r
}\r
\r
/** Does any stored key start with \`prefix\`? */\r
export const startsWith = (root: TrieNode, prefix: string): boolean => descend(root, prefix) !== null;\r
\r
/** Every stored word that begins with \`prefix\`, in sorted order (autocomplete). */\r
export function complete(root: TrieNode, prefix: string): string[] {\r
  const start = descend(root, prefix);\r
  if (!start) return [];\r
  const out: string[] = [];\r
  const walk = (node: TrieNode, acc: string) => {\r
    if (node.end) out.push(prefix + acc);\r
    for (const ch of Object.keys(node.children).sort()) walk(node.children[ch], acc + ch);\r
  };\r
  walk(start, '');\r
  return out;\r
}\r
\r
export const build = (words: string[]): TrieNode => {\r
  const r = create();\r
  for (const w of words) insert(r, w);\r
  return r;\r
};\r
\r
/** Total distinct nodes (for showing how shared prefixes save space). */\r
export function nodeCount(root: TrieNode): number {\r
  return 1 + Object.values(root.children).reduce((s, c) => s + nodeCount(c), 0);\r
}\r
`;export{e as default};