var e=`// Huffman coding — optimal prefix-free compression. Count how often each symbol\r
// appears, then greedily merge the two least-frequent nodes into a subtree until one\r
// tree remains; the path to each leaf (left = 0, right = 1) is its code. Frequent\r
// symbols get short codes, rare ones long codes, and because it's a tree no code is a\r
// prefix of another (so the stream decodes unambiguously with no separators). The\r
// result provably minimises total bits for a symbol-by-symbol code. Deterministic\r
// tie-breaking so the codes are reproducible. Tested.\r
\r
export interface Node { freq: number; symbol?: string; left?: Node; right?: Node; order: number }\r
\r
export function counts(text: string): Record<string, number> {\r
  const c: Record<string, number> = {};\r
  for (const ch of text) c[ch] = (c[ch] ?? 0) + 1;\r
  return c;\r
}\r
\r
/** Build the Huffman tree; ties broken by insertion order for reproducibility. */\r
export function buildTree(freqs: Record<string, number>): Node | null {\r
  let order = 0;\r
  let nodes: Node[] = Object.entries(freqs).map(([symbol, freq]) => ({ symbol, freq, order: order++ }));\r
  if (nodes.length === 0) return null;\r
  if (nodes.length === 1) return { freq: nodes[0].freq, left: nodes[0], order: order++ }; // single symbol → 1-bit code\r
  while (nodes.length > 1) {\r
    nodes.sort((a, b) => a.freq - b.freq || a.order - b.order);\r
    const left = nodes.shift()!, right = nodes.shift()!;\r
    nodes.push({ freq: left.freq + right.freq, left, right, order: order++ });\r
  }\r
  return nodes[0];\r
}\r
\r
/** Map each symbol to its bit-string code (left=0, right=1). */\r
export function buildCodes(tree: Node | null): Record<string, string> {\r
  const codes: Record<string, string> = {};\r
  const walk = (n: Node, path: string) => {\r
    if (n.symbol !== undefined) { codes[n.symbol] = path || '0'; return; }\r
    if (n.left) walk(n.left, path + '0');\r
    if (n.right) walk(n.right, path + '1');\r
  };\r
  if (tree) walk(tree, '');\r
  return codes;\r
}\r
\r
export interface HuffResult {\r
  codes: Record<string, string>;\r
  bits: string;\r
  originalBits: number; // fixed-width: 8 bits/char\r
  compressedBits: number;\r
  ratio: number;\r
}\r
\r
export function encode(text: string): HuffResult {\r
  const codes = buildCodes(buildTree(counts(text)));\r
  let bits = '';\r
  for (const ch of text) bits += codes[ch];\r
  const originalBits = text.length * 8;\r
  return { codes, bits, originalBits, compressedBits: bits.length, ratio: originalBits ? bits.length / originalBits : 0 };\r
}\r
\r
/** Decode a bit string back to text using the tree (proves the codes are prefix-free). */\r
export function decode(bits: string, tree: Node | null): string {\r
  if (!tree) return '';\r
  let out = '', n = tree;\r
  for (const b of bits) {\r
    n = (b === '0' ? n.left : n.right) ?? n;\r
    if (n.symbol !== undefined) { out += n.symbol; n = tree; }\r
  }\r
  return out;\r
}\r
`;export{e as default};