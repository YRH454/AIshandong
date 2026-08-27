var e=`// Turn the user's input into payload bytes. Pure and testable.\r
//   text   -> UTF-8 bytes ("443" -> 34 34 33)\r
//   number -> big-endian bytes; non-negative packs unsigned (443 -> 01 BB),\r
//             negative packs as minimal-width two's complement (-1 -> FF, -200 -> FF 38)\r
export type Mode = 'text' | 'number';\r
\r
export interface Encoded {\r
  bytes: number[];\r
  error: string | null;\r
}\r
\r
export function encodePayload(input: string, mode: Mode): Encoded {\r
  if (mode === 'text') return { bytes: [...new TextEncoder().encode(input)], error: null };\r
\r
  const t = input.trim();\r
  if (!/^-?\\d+$/.test(t)) return { bytes: [], error: 'Enter an integer (negatives allowed).' };\r
\r
  let n = BigInt(t);\r
  if (n === 0n) return { bytes: [0], error: null };\r
\r
  if (n > 0n) {\r
    const out: number[] = [];\r
    while (n > 0n) {\r
      out.unshift(Number(n & 0xffn));\r
      n >>= 8n;\r
    }\r
    return { bytes: out, error: null };\r
  }\r
\r
  // Negative: smallest byte width whose signed range still holds n, two's complement.\r
  let width = 1;\r
  while (n < -(1n << BigInt(width * 8 - 1))) width++;\r
  const mod = (1n << BigInt(width * 8)) + n; // two's complement value\r
  const out: number[] = [];\r
  for (let i = width - 1; i >= 0; i--) out.push(Number((mod >> BigInt(i * 8)) & 0xffn));\r
  return { bytes: out, error: null };\r
}\r
`;export{e as default};