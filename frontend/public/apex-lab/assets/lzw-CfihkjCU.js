var e=`// LZW compression (Lempel-Ziv-Welch, 1984) — the dictionary scheme behind GIF, TIFF, PDF,\r
// and old Unix \`compress\`. Unlike LZ77's sliding window, LZW builds a dictionary on the fly\r
// that BOTH sides reconstruct identically, so the codes alone are enough to decode — no\r
// offsets, no explicit dictionary shipped. It starts with every single byte already in the\r
// dictionary, then greedily extends: emit the longest prefix it already knows, and add that\r
// prefix-plus-the-next-byte as a new entry. Repetition quickly builds long dictionary\r
// entries, so repeated substrings collapse to a single code. Pure and tested (independent\r
// decoder → round-trip is a real check; the ABABABA codes are hand-verified).\r
\r
export interface Step { emit: number; forString: string; added: { code: number; str: string } | null }\r
\r
export interface Encoded { codes: number[]; steps: Step[]; finalDictSize: number }\r
\r
/** Encode a string to LZW codes, recording each emitted code and dictionary addition. */\r
export function encode(input: string): Encoded {\r
  const dict = new Map<string, number>();\r
  for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);\r
  let next = 256;\r
  const codes: number[] = [];\r
  const steps: Step[] = [];\r
  if (input === '') return { codes, steps, finalDictSize: next };\r
\r
  let w = input[0];\r
  for (let i = 1; i < input.length; i++) {\r
    const c = input[i];\r
    const wc = w + c;\r
    if (dict.has(wc)) {\r
      w = wc; // keep extending the match\r
    } else {\r
      const code = dict.get(w)!;\r
      codes.push(code);\r
      dict.set(wc, next);\r
      steps.push({ emit: code, forString: w, added: { code: next, str: wc } });\r
      next++;\r
      w = c;\r
    }\r
  }\r
  codes.push(dict.get(w)!);\r
  steps.push({ emit: dict.get(w)!, forString: w, added: null });\r
  return { codes, steps, finalDictSize: next };\r
}\r
\r
/** Decode LZW codes, rebuilding the same dictionary the encoder did. */\r
export function decode(codes: number[]): string {\r
  if (codes.length === 0) return '';\r
  const dict: string[] = [];\r
  for (let i = 0; i < 256; i++) dict.push(String.fromCharCode(i));\r
  let prev = dict[codes[0]];\r
  let out = prev;\r
  for (let i = 1; i < codes.length; i++) {\r
    const code = codes[i];\r
    // the classic special case: a code can refer to the entry being created this step\r
    const entry = code < dict.length ? dict[code] : prev + prev[0];\r
    out += entry;\r
    dict.push(prev + entry[0]);\r
    prev = entry;\r
  }\r
  return out;\r
}\r
\r
export const strBytes = (s: string): number => s.length;\r
`;export{e as default};