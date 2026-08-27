var e=`// Feistel networks — the other great block-cipher structure (DES, Blowfish, Twofish,\r
// GOST). Split the block into two halves L,R and each round do L,R = R, L⊕F(R,Kᵢ).\r
// The magic: this is reversible for ANY round function F — even one that throws\r
// information away — because decryption just runs the same structure backward. That's\r
// the opposite of AES's substitution-permutation network, where every single step has\r
// to be individually invertible. We use a deliberately non-invertible F to prove the\r
// point. Toy 16-bit block (two bytes); the structure is the lesson. Tested.\r
\r
export const ROUNDS = 8;\r
\r
/** A deliberately NON-invertible round function: r·r mod 256 is many-to-one\r
 *  (r and 256−r collide), yet the Feistel cipher still decrypts perfectly. */\r
export const roundF = (r: number, k: number): number => (((r * r) & 0xff) ^ k) & 0xff;\r
\r
/** A simple key schedule: one byte per round, mixed from the key. */\r
export function roundKeys(key: number, rounds = ROUNDS): number[] {\r
  return Array.from({ length: rounds }, (_, i) => ((key * (i + 1)) ^ (0x3b * i + 0x9e)) & 0xff);\r
}\r
\r
export interface FRound { round: number; L: number; R: number; f: number; key: number }\r
\r
/** Encrypt (L,R): each round L,R ← R, L ⊕ F(R,Kᵢ). Returns a per-round trace. */\r
export function encryptTrace(L: number, R: number, keys: number[]): FRound[] {\r
  const trace: FRound[] = [{ round: 0, L, R, f: 0, key: 0 }];\r
  for (let i = 0; i < keys.length; i++) {\r
    const f = roundF(R, keys[i]);\r
    [L, R] = [R, L ^ f];\r
    trace.push({ round: i + 1, L, R, f, key: keys[i] });\r
  }\r
  return trace;\r
}\r
\r
/** Decrypt: run the rounds backward. Given (L,R) after round i: R_{i-1}=L, L_{i-1}=R⊕F(L,Kᵢ). */\r
export function decryptTrace(L: number, R: number, keys: number[]): FRound[] {\r
  const trace: FRound[] = [{ round: keys.length, L, R, f: 0, key: 0 }];\r
  for (let i = keys.length - 1; i >= 0; i--) {\r
    const f = roundF(L, keys[i]);\r
    [L, R] = [R ^ f, L];\r
    trace.push({ round: i, L, R, f, key: keys[i] });\r
  }\r
  return trace;\r
}\r
\r
export const encrypt = (L: number, R: number, keys: number[]): [number, number] => {\r
  const t = encryptTrace(L, R, keys); const last = t[t.length - 1]; return [last.L, last.R];\r
};\r
export const decrypt = (L: number, R: number, keys: number[]): [number, number] => {\r
  const t = decryptTrace(L, R, keys); const last = t[t.length - 1]; return [last.L, last.R];\r
};\r
`;export{e as default};