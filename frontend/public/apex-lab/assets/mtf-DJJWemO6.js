var e=`// Move-to-front (MTF) coding — the stage that sits between the Burrows-Wheeler transform and the entropy\r
// coder in bzip2. Keep an ordered list of the alphabet; to encode a symbol, output its CURRENT index in\r
// the list, then move it to the front. A symbol used again immediately codes as 0, and a recently-used\r
// one codes as a small number — so a run of the same character (exactly what the BWT produces) becomes a\r
// run of ZEROS, and skewed-but-shifting data becomes a stream of small integers an entropy coder loves.\r
// It's perfectly reversible: decode reads each index, emits that list entry, and moves it to the front,\r
// reconstructing the same list state. Reference: Bentley et al. 1986; bzip2's BWT → MTF → RLE → Huffman.\r
\r
/** Encode a string against an ordered \`alphabet\`, returning the move-to-front index of each symbol. */\r
export function encode(input: string, alphabet: string[]): number[] {\r
  const list = [...alphabet];\r
  const out: number[] = [];\r
  for (const c of input) {\r
    const idx = list.indexOf(c);\r
    out.push(idx);\r
    list.splice(idx, 1);   // remove from its position…\r
    list.unshift(c);       // …and put it at the front\r
  }\r
  return out;\r
}\r
\r
/** Inverse: read indices, emit the list entry at each, moving it to the front to track the same state. */\r
export function decode(indices: number[], alphabet: string[]): string {\r
  const list = [...alphabet];\r
  let out = '';\r
  for (const idx of indices) {\r
    const c = list[idx];\r
    out += c;\r
    list.splice(idx, 1);\r
    list.unshift(c);\r
  }\r
  return out;\r
}\r
\r
/** Trace each step (symbol, emitted index, list state after) for the visualization. */\r
export interface MtfStep { sym: string; index: number; listAfter: string[] }\r
export function trace(input: string, alphabet: string[]): MtfStep[] {\r
  const list = [...alphabet];\r
  return [...input].map((c) => {\r
    const idx = list.indexOf(c);\r
    list.splice(idx, 1); list.unshift(c);\r
    return { sym: c, index: idx, listAfter: [...list] };\r
  });\r
}\r
\r
/** Distinct sorted characters of a string — the natural starting alphabet. */\r
export const alphabetOf = (s: string) => [...new Set(s)].sort();\r
`;export{e as default};