var e=`// Error detection & correction — the real math behind "did these bytes survive\r
// the wire?". Every function here is genuine and cross-checked in tests against\r
// the engine's own primitives and against published check values.\r
//\r
// Refs: RFC 1071 (Internet checksum), IEEE 802.3 (CRC-32), Hamming (1950),\r
// ISO/IEC 7812 (Luhn). The "bytes are real" creed applies here too.\r
\r
/** Even/odd parity bit for a byte: the single bit that makes the count of 1s even (or odd). */\r
export function parityBit(byte: number, odd = false): number {\r
  let ones = 0;\r
  for (let i = 0; i < 8; i++) ones += (byte >> i) & 1;\r
  const even = ones & 1; // 1 if an odd number of ones → need a 1 to make it even\r
  return odd ? even ^ 1 : even;\r
}\r
\r
// ---- Internet checksum (RFC 1071), traced ----------------------------------\r
\r
export interface CkStep {\r
  word: number; // the 16-bit word added\r
  runningSum: number; // sum after adding this word (before final fold)\r
}\r
export interface CkResult {\r
  steps: CkStep[];\r
  folded: number; // sum after end-around carry fold\r
  checksum: number; // one's complement of folded\r
}\r
\r
/** One's-complement 16-bit sum with end-around carry, exposing each step. */\r
export function internetChecksum(bytes: number[]): CkResult {\r
  const steps: CkStep[] = [];\r
  let sum = 0;\r
  for (let i = 0; i < bytes.length; i += 2) {\r
    const word = (bytes[i] << 8) | (i + 1 < bytes.length ? bytes[i + 1] : 0);\r
    sum += word;\r
    steps.push({ word, runningSum: sum });\r
  }\r
  while (sum >> 16) sum = (sum & 0xffff) + (sum >> 16);\r
  return { steps, folded: sum, checksum: (~sum) & 0xffff };\r
}\r
\r
// ---- CRC as a shift register (LFSR), traced --------------------------------\r
\r
/** A small CRC so the LFSR is watchable. CRC-8/SMBUS: poly 0x07, init 0x00. */\r
export const CRC8 = { poly: 0x07, width: 8 };\r
\r
export interface CrcStep {\r
  inByte: number; // which source byte this clock belongs to\r
  clock: number; // 0..7 within that byte\r
  absorbed: number | null; // the byte XOR'd into the register at clock 0 (else null)\r
  before: number; // register before this clock\r
  popped: number; // the bit shifted out of the top\r
  xored: boolean; // did we XOR the polynomial this clock?\r
  after: number; // register after this clock\r
}\r
export interface CrcResult {\r
  steps: CrcStep[];\r
  remainder: number; // the final CRC (matches the published CRC-8 check value)\r
}\r
\r
/**\r
 * CRC-8 as a shift register, MSB-first — the textbook formulation that matches\r
 * the published check value (0xF4 for "123456789", poly 0x07, init 0). Each\r
 * input byte is XOR'd into the register, then the register is clocked 8 times.\r
 */\r
export function crc8Trace(bytes: number[]): CrcResult {\r
  const { poly, width } = CRC8;\r
  const widthMask = (1 << width) - 1;\r
  const topMask = 1 << (width - 1);\r
  let reg = 0;\r
  const steps: CrcStep[] = [];\r
  for (let bi = 0; bi < bytes.length; bi++) {\r
    reg ^= bytes[bi]; // absorb the byte into the top of the register\r
    for (let clock = 0; clock < 8; clock++) {\r
      const before = reg;\r
      const popped = (reg & topMask) ? 1 : 0;\r
      let next = (reg << 1) & widthMask;\r
      const xored = popped === 1; // if the bit clocked out is 1, fold in the poly\r
      if (xored) next ^= poly;\r
      reg = next;\r
      steps.push({ inByte: bi, clock, absorbed: clock === 0 ? bytes[bi] : null, before, popped, xored, after: reg });\r
    }\r
  }\r
  return { steps, remainder: reg & widthMask };\r
}\r
\r
// ---- Hamming(7,4): single-error CORRECTION ---------------------------------\r
// Bit positions 1..7 (1-indexed). Parity bits sit at powers of two (1,2,4);\r
// data bits fill the rest (3,5,6,7). Each parity bit covers the positions whose\r
// index has its bit set — that's what lets the syndrome point at the culprit.\r
\r
export interface Hamming {\r
  data: number[]; // 4 data bits (d1..d4), MSB-first\r
  code: number[]; // 7 encoded bits, position 1..7\r
  parity: { p1: number; p2: number; p3: number };\r
}\r
\r
/** Encode 4 data bits into a 7-bit Hamming codeword. */\r
export function hammingEncode(data: number[]): Hamming {\r
  const d = data.map((b) => (b ? 1 : 0));\r
  const [d1, d2, d3, d4] = d;\r
  const p1 = d1 ^ d2 ^ d4; // covers positions 1,3,5,7\r
  const p2 = d1 ^ d3 ^ d4; // covers positions 2,3,6,7\r
  const p3 = d2 ^ d3 ^ d4; // covers positions 4,5,6,7\r
  // position:   1   2   3   4   5   6   7\r
  const code = [p1, p2, d1, p3, d2, d3, d4];\r
  return { data: d, code, parity: { p1, p2, p3 } };\r
}\r
\r
export interface HammingDecode {\r
  syndrome: number; // 0 = clean; otherwise the 1-indexed position of the flipped bit\r
  corrected: number[]; // the 7-bit codeword after correction\r
  data: number[]; // the recovered 4 data bits\r
  errorPos: number | null;\r
}\r
\r
/** Decode a 7-bit codeword, locating and correcting any single-bit error. */\r
export function hammingDecode(code7: number[]): HammingDecode {\r
  const c = code7.map((b) => (b ? 1 : 0));\r
  // recompute parity over positions (1-indexed): syndrome bits s1,s2,s3\r
  const at = (pos: number) => c[pos - 1];\r
  const s1 = at(1) ^ at(3) ^ at(5) ^ at(7);\r
  const s2 = at(2) ^ at(3) ^ at(6) ^ at(7);\r
  const s3 = at(4) ^ at(5) ^ at(6) ^ at(7);\r
  const syndrome = (s3 << 2) | (s2 << 1) | s1; // points at the bad position\r
  const corrected = c.slice();\r
  let errorPos: number | null = null;\r
  if (syndrome !== 0 && syndrome <= 7) {\r
    corrected[syndrome - 1] ^= 1;\r
    errorPos = syndrome;\r
  }\r
  const data = [corrected[2], corrected[4], corrected[5], corrected[6]];\r
  return { syndrome, corrected, data, errorPos };\r
}\r
\r
// ---- Luhn (the credit-card / IMEI check digit) -----------------------------\r
\r
export interface LuhnResult {\r
  digits: number[];\r
  doubled: number[]; // each position's contribution after the Luhn doubling\r
  sum: number;\r
  valid: boolean;\r
}\r
\r
/** Validate a number string with the Luhn algorithm (mod-10 check digit). */\r
export function luhn(input: string): LuhnResult | null {\r
  const digits = input.replace(/[\\s-]/g, '');\r
  if (!/^\\d+$/.test(digits)) return null;\r
  const ds = [...digits].map(Number);\r
  const doubled: number[] = [];\r
  let sum = 0;\r
  // double every second digit from the right\r
  for (let i = ds.length - 1, pos = 0; i >= 0; i--, pos++) {\r
    let v = ds[i];\r
    if (pos % 2 === 1) {\r
      v *= 2;\r
      if (v > 9) v -= 9;\r
    }\r
    doubled[i] = v;\r
    sum += v;\r
  }\r
  return { digits: ds, doubled, sum, valid: sum % 10 === 0 };\r
}\r
`;export{e as default};