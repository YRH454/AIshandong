var e=`// Beyond ECB/CBC — turning the AES block cipher into a real, authenticated\r
// stream cipher, with the bytes kept honest:\r
//   • CTR mode: encrypt a counter, XOR the keystream over the data. No padding,\r
//     parallelisable, and encrypt == decrypt. Verified to NIST SP 800-38A F.5.\r
//   • Nonce reuse: reuse a (key, nonce) and the keystream repeats, so C1 ⊕ C2 =\r
//     P1 ⊕ P2 — the keystream cancels and the plaintexts leak. Shown, not told.\r
//   • GCM (AEAD): CTR for secrecy + a GHASH authentication tag over GF(2^128) for\r
//     integrity. Full encrypt+tag built from scratch and verified to the canonical\r
//     McGrew–Viega / NIST SP 800-38D GCM test vectors.\r
import { expandKey128, encryptBlock } from './aes';\r
\r
const xorInto = (dst: Uint8Array, a: Uint8Array, b: Uint8Array, n: number) => {\r
  for (let j = 0; j < n; j++) dst[j] = a[j] ^ b[j];\r
};\r
\r
/** +1 over the full 128-bit counter, big-endian (NIST SP 800-38A CTR). */\r
function incFull(ctr: Uint8Array) {\r
  for (let i = 15; i >= 0; i--) { ctr[i] = (ctr[i] + 1) & 0xff; if (ctr[i] !== 0) break; }\r
}\r
/** +1 over only the rightmost 32 bits (GCM's inc32). */\r
function inc32(ctr: Uint8Array) {\r
  for (let i = 15; i >= 12; i--) { ctr[i] = (ctr[i] + 1) & 0xff; if (ctr[i] !== 0) break; }\r
}\r
\r
export interface CtrResult {\r
  keystream: Uint8Array; // AES(counter) bytes, in order\r
  out: Uint8Array; // data XOR keystream (ciphertext when encrypting, plaintext when decrypting)\r
  counters: Uint8Array[]; // each 16-byte counter block consumed\r
}\r
\r
/** CTR-mode process (encrypt or decrypt — identical operation). */\r
export function aesCtr(data: Uint8Array, key: Uint8Array, icb: Uint8Array, mode: 'full' | 'gcm32' = 'full'): CtrResult {\r
  const rks = expandKey128(key);\r
  const ctr = icb.slice();\r
  const out = new Uint8Array(data.length);\r
  const keystream = new Uint8Array(data.length);\r
  const counters: Uint8Array[] = [];\r
  for (let off = 0; off < data.length; off += 16) {\r
    counters.push(ctr.slice());\r
    const ks = encryptBlock(ctr, rks);\r
    const n = Math.min(16, data.length - off);\r
    for (let j = 0; j < n; j++) { keystream[off + j] = ks[j]; out[off + j] = data[off + j] ^ ks[j]; }\r
    if (mode === 'gcm32') inc32(ctr); else incFull(ctr);\r
  }\r
  return { keystream, out, counters };\r
}\r
\r
/** Build a CTR initial counter block from a nonce: nonce || 0…0 || counterStart. */\r
export function ctrBlock(nonce: Uint8Array, counterStart = 1): Uint8Array {\r
  const b = new Uint8Array(16);\r
  b.set(nonce.subarray(0, 12));\r
  b[15] = counterStart & 0xff;\r
  return b;\r
}\r
\r
// ── GF(2^128) and GHASH (NIST SP 800-38D) ────────────────────────────────────\r
const R0 = 0xe1; // the reduction polynomial x^128 + x^7 + x^2 + x + 1, top byte\r
\r
/** Multiply two 128-bit field elements in GCM's bit order. */\r
export function gfmul(X: Uint8Array, Y: Uint8Array): Uint8Array {\r
  const Z = new Uint8Array(16);\r
  const V = Y.slice();\r
  for (let i = 0; i < 128; i++) {\r
    if ((X[i >> 3] >> (7 - (i & 7))) & 1) for (let k = 0; k < 16; k++) Z[k] ^= V[k];\r
    const lsb = V[15] & 1;\r
    for (let k = 15; k > 0; k--) V[k] = ((V[k] >> 1) | ((V[k - 1] & 1) << 7)) & 0xff;\r
    V[0] = (V[0] >> 1) & 0xff;\r
    if (lsb) V[0] ^= R0;\r
  }\r
  return Z;\r
}\r
\r
/** GHASH_H over a 16-byte-aligned buffer. */\r
export function ghash(H: Uint8Array, blocks: Uint8Array): Uint8Array {\r
  let X: Uint8Array = new Uint8Array(16);\r
  for (let off = 0; off < blocks.length; off += 16) {\r
    const t = new Uint8Array(16);\r
    for (let k = 0; k < 16; k++) t[k] = X[k] ^ blocks[off + k];\r
    X = gfmul(t, H);\r
  }\r
  return X;\r
}\r
\r
function putU64BE(arr: Uint8Array, off: number, val: number) {\r
  for (let i = 7; i >= 0; i--) { arr[off + i] = val & 0xff; val = Math.floor(val / 256); }\r
}\r
\r
export interface GcmResult {\r
  ciphertext: Uint8Array;\r
  tag: Uint8Array; // 16-byte authentication tag\r
  H: Uint8Array; // the hash subkey AES_K(0^128) — exposed for the view\r
}\r
\r
/** J0 for a 96-bit IV: IV ‖ 0^31 ‖ 1. */\r
function gcmJ0(iv: Uint8Array): Uint8Array {\r
  const J0 = new Uint8Array(16); J0.set(iv.subarray(0, 12)); J0[15] = 1; return J0;\r
}\r
\r
/** The GCM tag over a given ciphertext: T = GCTR_K(J0, GHASH_H(A ‖ C ‖ lens)). */\r
function gcmTag(H: Uint8Array, key: Uint8Array, J0: Uint8Array, ciphertext: Uint8Array, aad: Uint8Array): Uint8Array {\r
  const padA = Math.ceil(aad.length / 16) * 16;\r
  const padC = Math.ceil(ciphertext.length / 16) * 16;\r
  const ghashIn = new Uint8Array(padA + padC + 16);\r
  ghashIn.set(aad, 0);\r
  ghashIn.set(ciphertext, padA);\r
  putU64BE(ghashIn, padA + padC, aad.length * 8);\r
  putU64BE(ghashIn, padA + padC + 8, ciphertext.length * 8);\r
  const S = ghash(H, ghashIn);\r
  return aesCtr(S, key, J0.slice(), 'gcm32').out; // T = GCTR_K(J0, S)\r
}\r
\r
/** AES-128-GCM encrypt with a 96-bit IV (the common case). */\r
export function aesGcmEncrypt(plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array, aad: Uint8Array = new Uint8Array(0)): GcmResult {\r
  const rks = expandKey128(key);\r
  const H = encryptBlock(new Uint8Array(16), rks); // hash subkey\r
  const J0 = gcmJ0(iv);\r
  const icb = J0.slice(); inc32(icb);\r
  const ciphertext = aesCtr(plaintext, key, icb, 'gcm32').out;\r
  const tag = gcmTag(H, key, J0, ciphertext, aad);\r
  return { ciphertext, tag, H };\r
}\r
\r
export interface GcmOpen { plaintext: Uint8Array; authentic: boolean }\r
\r
/** AES-128-GCM decrypt+verify: recompute the tag over the RECEIVED ciphertext and\r
 *  compare. If a byte was tampered, the tags differ and \`authentic\` is false. */\r
export function aesGcmDecrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array, tag: Uint8Array, aad: Uint8Array = new Uint8Array(0)): GcmOpen {\r
  const rks = expandKey128(key);\r
  const H = encryptBlock(new Uint8Array(16), rks);\r
  const J0 = gcmJ0(iv);\r
  const expected = gcmTag(H, key, J0, ciphertext, aad);\r
  const icb = J0.slice(); inc32(icb);\r
  const plaintext = aesCtr(ciphertext, key, icb, 'gcm32').out;\r
  return { plaintext, authentic: tagsEqual(expected, tag) };\r
}\r
\r
/** Constant-ish tag compare (the view uses it to accept/reject). */\r
export function tagsEqual(a: Uint8Array, b: Uint8Array): boolean {\r
  if (a.length !== b.length) return false;\r
  let d = 0;\r
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];\r
  return d === 0;\r
}\r
\r
/** XOR two equal-length byte strings (used to show the keystream cancelling). */\r
export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {\r
  const n = Math.min(a.length, b.length);\r
  const out = new Uint8Array(n);\r
  xorInto(out, a, b, n);\r
  return out;\r
}\r
`;export{e as default};