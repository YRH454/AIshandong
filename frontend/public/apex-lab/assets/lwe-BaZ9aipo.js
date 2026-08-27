var e=`// Post-quantum crypto, the lattice kernel made visible. Learning With Errors (LWE):\r
// publish A and b = A·s + e where e is small noise; recovering the secret s from\r
// (A, b) is believed hard even for a quantum computer (no periodic/factoring\r
// structure for Shor's algorithm to grab). Regev encryption rides on it: a message\r
// bit is hidden near 0 or q/2 and survives the noise because we round. This is the\r
// real idea inside ML-KEM (Kyber) — Kyber just works over polynomial rings with\r
// q=3329 and packs 256 bits at once. Small, honest, deterministic params here.\r
\r
export interface LweParams { n: number; q: number }\r
export const PARAMS: LweParams = { n: 4, q: 97 };\r
export const half = (q: number) => Math.floor(q / 2);\r
\r
const mod = (x: number, q: number) => ((x % q) + q) % q;\r
export const dot = (a: number[], b: number[], q: number) => mod(a.reduce((s, ai, i) => s + ai * b[i], 0), q);\r
export const matVec = (A: number[][], v: number[], q: number) => A.map((row) => dot(row, v, q));\r
export const transpose = (A: number[][]) => A[0].map((_, j) => A.map((row) => row[j]));\r
\r
export interface PublicKey { A: number[][]; b: number[] }\r
\r
/** Public key b = A·s + e (mod q); s is the secret, e the small noise hiding it. */\r
export function keyGen(A: number[][], s: number[], e: number[], q: number): PublicKey {\r
  const As = matVec(A, s, q);\r
  return { A, b: As.map((x, i) => mod(x + e[i], q)) };\r
}\r
\r
export interface Cipher { u: number[]; v: number }\r
\r
/** Encrypt one bit: u = Aᵀ·r + e1, v = b·r + e2 + bit·⌊q/2⌋ (mod q). */\r
export function encryptBit(pk: PublicKey, r: number[], e1: number[], e2: number, bit: 0 | 1, q: number): Cipher {\r
  const u = matVec(transpose(pk.A), r, q).map((x, i) => mod(x + e1[i], q));\r
  const v = mod(dot(pk.b, r, q) + e2 + bit * half(q), q);\r
  return { u, v };\r
}\r
\r
export interface Decryption { raw: number; centered: number; noise: number; bit: 0 | 1 }\r
\r
/** Decrypt: m = v − s·u ≈ bit·⌊q/2⌋ + (small). Round to the nearer of 0 / ⌊q/2⌋. */\r
export function decryptBit(s: number[], c: Cipher, q: number): Decryption {\r
  const raw = mod(c.v - dot(s, c.u, q), q);\r
  const bit: 0 | 1 = raw > q / 4 && raw < (3 * q) / 4 ? 1 : 0;\r
  const ideal = bit * half(q);\r
  let noise = raw - ideal;\r
  if (noise > q / 2) noise -= q;\r
  if (noise < -q / 2) noise += q;\r
  const centered = raw > q / 2 ? raw - q : raw;\r
  return { raw, centered, noise, bit };\r
}\r
\r
/** The decryption noise e·r + e2 − s·e1 — correct only while |noise| < q/4. */\r
export function noiseMargin(q: number) { return Math.floor(q / 4); }\r
`;export{e as default};