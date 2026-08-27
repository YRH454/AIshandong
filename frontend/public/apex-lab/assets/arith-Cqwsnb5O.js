var e=`// Arithmetic coding — the compressor that breaks Huffman's one-whole-bit-per-symbol floor. Instead of\r
// giving each symbol its own bit-string, it encodes the ENTIRE message as a single number in [0, 1):\r
// start with the interval [0,1), and for each symbol narrow it to the sub-interval that symbol's\r
// probability owns. After the whole message the interval is tiny, and ANY number inside it identifies\r
// the message exactly. Its width is the product of the symbol probabilities, so the bits needed\r
// (−log2 width) equal the message's information content — reaching the entropy that Huffman can only\r
// approximate (Huffman must spend ≥1 bit even on a 0.9-probability symbol). Decoding reverses it: see\r
// which symbol's sub-interval the number falls in, emit it, narrow, repeat. Reference: Witten, Neal &\r
// Cleary, "Arithmetic Coding for Data Compression" (CACM 1987). (Doubles suffice for short demos.)\r
\r
export interface Model { order: string[]; freq: Record<string, number> }\r
export interface Span { sym: string; lo: number; hi: number } // cumulative-probability sub-interval\r
\r
/** Build a frequency model from a message (every distinct character gets its count). */\r
export function modelOf(message: string): Model {\r
  const freq: Record<string, number> = {};\r
  for (const c of message) freq[c] = (freq[c] ?? 0) + 1;\r
  return { order: Object.keys(freq).sort(), freq };\r
}\r
\r
/** Each symbol's [lo, hi) slice of [0,1), by cumulative frequency. */\r
export function spans(model: Model): Span[] {\r
  const total = model.order.reduce((a, s) => a + model.freq[s], 0);\r
  const out: Span[] = [];\r
  let acc = 0;\r
  for (const sym of model.order) {\r
    const lo = acc / total;\r
    acc += model.freq[sym];\r
    out.push({ sym, lo, hi: acc / total });\r
  }\r
  return out;\r
}\r
\r
export interface Encoded { low: number; high: number; code: number; bits: number }\r
\r
/** Narrow [0,1) symbol by symbol; the code is the midpoint of the final interval. */\r
export function encode(message: string, model: Model): Encoded {\r
  const sp = spans(model);\r
  let low = 0, high = 1;\r
  for (const c of message) {\r
    const s = sp.find((x) => x.sym === c)!;\r
    const range = high - low;\r
    high = low + range * s.hi;\r
    low = low + range * s.lo;\r
  }\r
  const width = high - low;\r
  return { low, high, code: (low + high) / 2, bits: Math.ceil(-Math.log2(width)) };\r
}\r
\r
/** Reverse the process: repeatedly locate the symbol whose sub-interval holds \`code\`. */\r
export function decode(code: number, model: Model, length: number): string {\r
  const sp = spans(model);\r
  let low = 0, high = 1, out = '';\r
  for (let i = 0; i < length; i++) {\r
    const range = high - low;\r
    const value = (code - low) / range;\r
    const s = sp.find((x) => value >= x.lo && value < x.hi) ?? sp[sp.length - 1];\r
    out += s.sym;\r
    high = low + range * s.hi;\r
    low = low + range * s.lo;\r
  }\r
  return out;\r
}\r
\r
/** Shannon information content of the message under the model (the ideal bit count). */\r
export function entropyBits(message: string, model: Model): number {\r
  const total = model.order.reduce((a, s) => a + model.freq[s], 0);\r
  let bits = 0;\r
  for (const c of message) bits += -Math.log2(model.freq[c] / total);\r
  return bits;\r
}\r
\r
/** A lower bound on Huffman's size: it must spend at least 1 whole bit per symbol. */\r
export const huffmanFloorBits = (message: string) => message.length;\r
`;export{e as default};