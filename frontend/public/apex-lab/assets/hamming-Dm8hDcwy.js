var e=`// Hamming(7,4) — the first error-CORRECTING code (Richard Hamming, Bell Labs, 1950), born of frustration: the\r
// weekend batch computer would halt on a detected parity error and waste his whole run, so he asked whether the\r
// machine could not just detect but FIX the error and keep going. His answer encodes 4 data bits into a 7-bit\r
// codeword by adding 3 parity bits, placed at positions 1, 2, 4 — the powers of two. The magic is in that\r
// placement: parity bit at position 2^k checks exactly those positions whose index has bit k set. So position 5\r
// (binary 101) is covered by the parity bits at 1 and 4; position 6 (110) by 2 and 4; and so on. To decode, you\r
// recompute the three parity checks; read their pass/fail as a 3-bit number — the SYNDROME — and it is not just a\r
// yes/no, it is the BINARY INDEX of the flipped bit. Syndrome 000 means clean; 101 means "position 5 is wrong,"\r
// so you flip it back. One code corrects any single-bit error and needs only log-many parity bits (the (7,4),\r
// (15,11), (31,26)… family). Add one more overall-parity bit and you get SECDED — Single Error Correct, Double\r
// Error Detect — which is exactly what the ECC memory in servers uses on every read. This models encode, the\r
// syndrome, and correction. Reference: Hamming, "Error Detecting and Error Correcting Codes," BSTJ (1950).\r
\r
// Positions are 1..7 (stored 0-indexed at p-1). Parity at 1,2,4; data at 3,5,6,7.\r
const DATA_POS = [3, 5, 6, 7];\r
const CHECKS = [\r
  { parity: 1, covers: [1, 3, 5, 7] }, // bit 0\r
  { parity: 2, covers: [2, 3, 6, 7] }, // bit 1\r
  { parity: 4, covers: [4, 5, 6, 7] }, // bit 2\r
];\r
\r
/** Encode 4 data bits into a 7-bit Hamming codeword (positions 1..7). */\r
export function encode(data: number[]): number[] {\r
  const c = new Array(7).fill(0);\r
  DATA_POS.forEach((p, i) => { c[p - 1] = data[i] & 1; });\r
  for (const { parity, covers } of CHECKS) {\r
    c[parity - 1] = covers.filter((p) => p !== parity).reduce((x, p) => x ^ c[p - 1], 0); // even parity over data it covers\r
  }\r
  return c;\r
}\r
\r
/** The syndrome: recompute each parity check; the checks that fail form the binary index of the bad bit (0 = clean). */\r
export function syndrome(code: number[]): number {\r
  let s = 0;\r
  for (const { parity, covers } of CHECKS) {\r
    const fail = covers.reduce((x, p) => x ^ code[p - 1], 0); // XOR of all covered positions incl the parity bit\r
    if (fail) s += parity;\r
  }\r
  return s;\r
}\r
\r
export interface Decoded { corrected: number[]; data: number[]; errorPos: number }\r
/** Decode: locate any single-bit error via the syndrome, flip it back, and extract the 4 data bits. */\r
export function decode(code: number[]): Decoded {\r
  const errorPos = syndrome(code);\r
  const corrected = code.slice();\r
  if (errorPos !== 0) corrected[errorPos - 1] ^= 1;\r
  const data = DATA_POS.map((p) => corrected[p - 1]);\r
  return { corrected, data, errorPos };\r
}\r
\r
/** Which positions each parity bit covers (for the view). */\r
export const checkCover = CHECKS;\r
export const dataPositions = DATA_POS;\r
`;export{e as default};