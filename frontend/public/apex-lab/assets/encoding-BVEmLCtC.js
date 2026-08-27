var e=`// Pure, testable encoding logic for the Encoding section. The same "bytes are\r
// real" creed applies: every transformation here is genuine, not illustrative.\r
\r
/** One character of a string with its Unicode code point and real UTF-8 bytes. */\r
export interface CharCell {\r
  char: string;\r
  codepoint: number;\r
  bytes: number[];\r
}\r
\r
/** Break a string into characters (by code point) with their UTF-8 encoding. */\r
export function utf8Breakdown(s: string): CharCell[] {\r
  const enc = new TextEncoder();\r
  const out: CharCell[] = [];\r
  for (const char of s) {\r
    // \`for…of\` iterates by code point, so surrogate pairs (emoji) stay whole.\r
    out.push({ char, codepoint: char.codePointAt(0) ?? 0, bytes: [...enc.encode(char)] });\r
  }\r
  return out;\r
}\r
\r
export interface BaseView {\r
  ok: boolean;\r
  decimal: string;\r
  binary: string; // grouped in nibbles\r
  hex: string;\r
  octal: string;\r
  bits: number[]; // MSB-first, \`width\` long\r
  width: number; // 8 | 16 | 32\r
  negative: boolean;\r
}\r
\r
/** Render an integer in binary/hex/octal, using two's complement for negatives. */\r
export function toBases(input: string, width: 8 | 16 | 32 = 8): BaseView {\r
  const t = input.trim();\r
  if (!/^-?\\d+$/.test(t)) return { ok: false, decimal: '', binary: '', hex: '', octal: '', bits: [], width, negative: false };\r
  let n = BigInt(t);\r
  const max = (1n << BigInt(width)) - 1n;\r
  const negative = n < 0n;\r
  // two's complement into the fixed width\r
  let mod = ((n % (1n << BigInt(width))) + (1n << BigInt(width))) % (1n << BigInt(width));\r
  if (!negative && n > max) mod = n & max; // clamp oversized positives to the width\r
  const bits: number[] = [];\r
  for (let i = width - 1; i >= 0; i--) bits.push(Number((mod >> BigInt(i)) & 1n));\r
  const binRaw = mod.toString(2).padStart(width, '0');\r
  const binary = binRaw.replace(/(.{4})(?=.)/g, '$1 ');\r
  return {\r
    ok: true,\r
    decimal: n.toString(),\r
    binary,\r
    hex: '0x' + mod.toString(16).toUpperCase().padStart(width / 4, '0'),\r
    octal: '0o' + mod.toString(8),\r
    bits,\r
    width,\r
    negative,\r
  };\r
}\r
\r
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';\r
\r
export interface B64Group {\r
  bytes: number[]; // 1..3 source bytes\r
  bits: string; // the 24-bit (or padded) bit string\r
  indices: (number | null)[]; // four 6-bit values (null = padding)\r
  chars: string[]; // four output chars ('=' for padding)\r
}\r
\r
export interface B64Result {\r
  groups: B64Group[];\r
  output: string;\r
}\r
\r
/** Base64-encode bytes, exposing each 3-byte → 4-char group for the step view. */\r
export function base64Steps(bytes: number[]): B64Result {\r
  const groups: B64Group[] = [];\r
  let output = '';\r
  for (let i = 0; i < bytes.length; i += 3) {\r
    const chunk = bytes.slice(i, i + 3);\r
    const bitStr = chunk.map((b) => b.toString(2).padStart(8, '0')).join('');\r
    const padded = bitStr.padEnd(24, '0');\r
    const indices: (number | null)[] = [];\r
    const chars: string[] = [];\r
    for (let g = 0; g < 4; g++) {\r
      // a 6-bit group is real only if it covers at least one real source bit\r
      if (g * 6 < chunk.length * 8) {\r
        const v = parseInt(padded.slice(g * 6, g * 6 + 6), 2);\r
        indices.push(v);\r
        chars.push(B64[v]);\r
      } else {\r
        indices.push(null);\r
        chars.push('=');\r
      }\r
    }\r
    groups.push({ bytes: chunk, bits: bitStr, indices, chars });\r
    output += chars.join('');\r
  }\r
  return { groups, output };\r
}\r
\r
/** Decompose a JS number into IEEE-754 single-precision (32-bit) parts. */\r
export interface FloatView {\r
  ok: boolean;\r
  bits: number[]; // 32, MSB first\r
  sign: number;\r
  exponentBits: number[];\r
  mantissaBits: number[];\r
  exponentRaw: number;\r
  exponentUnbiased: number;\r
  reconstructed: number;\r
  hex: string;\r
}\r
\r
export function float32Bits(input: string): FloatView {\r
  const t = input.trim();\r
  if (!/^-?\\d*\\.?\\d+(e-?\\d+)?$/i.test(t)) {\r
    return { ok: false, bits: [], sign: 0, exponentBits: [], mantissaBits: [], exponentRaw: 0, exponentUnbiased: 0, reconstructed: 0, hex: '' };\r
  }\r
  const buf = new ArrayBuffer(4);\r
  new DataView(buf).setFloat32(0, Number(t), false); // big-endian\r
  const u = new DataView(buf).getUint32(0, false);\r
  const bits: number[] = [];\r
  for (let i = 31; i >= 0; i--) bits.push((u >>> i) & 1);\r
  const exponentRaw = (u >>> 23) & 0xff;\r
  return {\r
    ok: true,\r
    bits,\r
    sign: bits[0],\r
    exponentBits: bits.slice(1, 9),\r
    mantissaBits: bits.slice(9),\r
    exponentRaw,\r
    exponentUnbiased: exponentRaw - 127,\r
    reconstructed: new DataView(buf).getFloat32(0, false),\r
    hex: '0x' + u.toString(16).toUpperCase().padStart(8, '0'),\r
  };\r
}\r
`;export{e as default};