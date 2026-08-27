var e=`// LZ77 sliding-window compression (Lempel & Ziv, 1977 — the dictionary half of DEFLATE,\r
// which gzip/zlib/PNG pair with Huffman coding). The data itself is the dictionary: at\r
// each position the encoder looks back over a window of already-seen bytes for the\r
// longest match of the text ahead, and emits a (distance, length, nextChar) token\r
// instead of the raw run. A distance-1 match copies a repeating byte, so long runs and\r
// repeated substrings collapse. Decoding just replays the copies. Pure and tested:\r
// the decoder is independent of the encoder, so round-tripping is a real correctness\r
// check, not a tautology.\r
\r
export interface Token { pos: number; offset: number; length: number; next: string }\r
\r
/** Encode \`input\` with a search window of \`window\` bytes. Every token reserves one\r
 *  literal \`next\` char, so the stream is always well-formed and round-trips. */\r
export function lz77(input: string, window = 32): Token[] {\r
  const tokens: Token[] = [];\r
  let pos = 0;\r
  while (pos < input.length) {\r
    const maxLen = input.length - pos - 1; // leave one char for \`next\`\r
    let bestLen = 0, bestOff = 0;\r
    // scan most-recent positions first so equal-length matches pick the smallest offset\r
    const start = Math.max(0, pos - window);\r
    for (let m = pos - 1; m >= start; m--) {\r
      let len = 0;\r
      while (len < maxLen && input[m + len] === input[pos + len]) len++; // overlap allowed\r
      if (len > bestLen) { bestLen = len; bestOff = pos - m; }\r
    }\r
    tokens.push({ pos, offset: bestLen ? bestOff : 0, length: bestLen, next: input[pos + bestLen] });\r
    pos += bestLen + 1;\r
  }\r
  return tokens;\r
}\r
\r
/** Reconstruct the original text from a token stream (overlap-safe). */\r
export function lz77Decode(tokens: Token[]): string {\r
  const out: string[] = [];\r
  for (const t of tokens) {\r
    const start = out.length - t.offset;\r
    for (let k = 0; k < t.length; k++) out.push(out[start + k]); // copy, possibly into what we just wrote\r
    if (t.next !== undefined) out.push(t.next);\r
  }\r
  return out.join('');\r
}\r
\r
export interface Stats { tokens: number; literals: number; copies: number; copiedChars: number; inputLen: number }\r
\r
export function stats(input: string, tokens: Token[]): Stats {\r
  const copies = tokens.filter((t) => t.length > 0).length;\r
  return {\r
    tokens: tokens.length,\r
    literals: tokens.filter((t) => t.length === 0).length,\r
    copies,\r
    copiedChars: tokens.reduce((s, t) => s + t.length, 0),\r
    inputLen: input.length,\r
  };\r
}\r
`;export{e as default};