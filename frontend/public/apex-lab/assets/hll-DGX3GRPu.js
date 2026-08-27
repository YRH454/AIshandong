var e=`// HyperLogLog (Flajolet et al., 2007) — estimate how many DISTINCT items a massive stream\r
// contains using a few kilobytes, no matter how many billions flow through. The intuition:\r
// hash each item to a random-looking bit string; the more distinct items you see, the more\r
// likely you are to have seen one with many leading zeros. Keep, per bucket, the largest\r
// "rank" (leftmost-1 position) observed; a register holding rank R hints ~2^R distinct\r
// items landed there. Averaging the m registers (harmonically) turns that hint into a\r
// cardinality estimate. Adding a duplicate never changes a register, so duplicates are\r
// free — that's what makes it count DISTINCT items. Pure; the deterministic core is tested.\r
\r
export interface Hll { p: number; m: number; registers: number[] }\r
\r
export function create(p: number): Hll {\r
  const m = 1 << p;\r
  return { p, m, registers: new Array(m).fill(0) };\r
}\r
\r
/** 32-bit string hash (FNV-1a) followed by a Murmur fmix32 finalizer so every bit is\r
 *  well-avalanched — HyperLogLog relies on the rank bits being uniformly distributed. */\r
export function hash(s: string): number {\r
  let h = 0x811c9dc5 >>> 0;\r
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }\r
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;\r
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;\r
  h ^= h >>> 16;\r
  return h >>> 0;\r
}\r
\r
/** Split a 32-bit hash into its bucket (top p bits) and rank (position of the leftmost 1\r
 *  in the remaining bits, 1-indexed; all-zero → wBits+1). */\r
export function bucketAndRank(h: number, p: number): { bucket: number; rank: number } {\r
  h = h >>> 0;\r
  const bucket = h >>> (32 - p);\r
  const wBits = 32 - p;\r
  const mask = wBits >= 32 ? 0xffffffff : (1 << wBits) - 1;\r
  const w = (h & mask) >>> 0;\r
  let rank = wBits + 1;\r
  for (let i = wBits - 1; i >= 0; i--) if ((w >>> i) & 1) { rank = wBits - i; break; }\r
  return { bucket, rank };\r
}\r
\r
export function add(hll: Hll, item: string): void {\r
  const { bucket, rank } = bucketAndRank(hash(item), hll.p);\r
  if (rank > hll.registers[bucket]) hll.registers[bucket] = rank; // keep the max\r
}\r
\r
function alpha(m: number): number {\r
  if (m === 16) return 0.673;\r
  if (m === 32) return 0.697;\r
  if (m === 64) return 0.709;\r
  return 0.7213 / (1 + 1.079 / m);\r
}\r
\r
/** The cardinality estimate, with small-range linear-counting correction. */\r
export function estimate(hll: Hll): number {\r
  const { m, registers } = hll;\r
  let sum = 0, zeros = 0;\r
  for (const r of registers) { sum += 2 ** -r; if (r === 0) zeros++; }\r
  let E = (alpha(m) * m * m) / sum;\r
  if (E <= 2.5 * m && zeros > 0) E = m * Math.log(m / zeros); // linear counting\r
  return E;\r
}\r
\r
export const fromItems = (p: number, items: string[]): Hll => {\r
  const h = create(p);\r
  for (const x of items) add(h, x);\r
  return h;\r
};\r
`;export{e as default};