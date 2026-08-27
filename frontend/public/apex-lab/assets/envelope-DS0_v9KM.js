var e=`// Envelope encryption — how AWS KMS, Google Cloud KMS, and every serious secrets system encrypt data at\r
// scale without ever exposing the master key. You do NOT encrypt your data directly with the master key. Two\r
// layers: (1) generate a fresh random DATA ENCRYPTION KEY (DEK) and encrypt the actual data with it; (2) ask\r
// the KMS to encrypt (WRAP) that little DEK with a KEY-ENCRYPTION KEY (KEK) that never leaves the KMS's\r
// hardware. You store the ciphertext next to the wrapped DEK. To read the data you send the wrapped DEK to the\r
// KMS, it unwraps it (the only place the KEK exists), hands back the plaintext DEK, and you decrypt locally.\r
// Two payoffs. The master KEK never touches your servers or your data — compromising an app server leaks at\r
// most one DEK, not the master key. And key ROTATION is nearly free: to rotate the master key you only\r
// re-wrap the tiny DEKs, never the terabytes of data they protect. This models the DEK/KEK hierarchy, wrapping,\r
// decryption, and rotation with a small but real reversible stream cipher. Reference: NIST key-wrapping;\r
// AWS/GCP KMS envelope-encryption docs.\r
\r
// A tiny hash-based stream cipher (teaching model): keystream byte from (key, position); XOR to en/decrypt.\r
const ksByte = (key: number, i: number): number => {\r
  let h = (Math.imul(key ^ (i * 2654435761), 2246822519)) >>> 0;\r
  h = ((h ^ (h >>> 15)) >>> 0);\r
  return h & 0xff;\r
};\r
const cipher = (data: number[], key: number): number[] => data.map((b, i) => b ^ ksByte(key, i)); // symmetric\r
\r
const num4 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];\r
const bytes4 = (b: number[]): number => ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;\r
\r
export interface Envelope { ciphertext: number[]; wrappedDEK: number[] }\r
\r
/** Encrypt the data under a fresh DEK, then wrap the DEK under the KEK. The KEK never sees the data. */\r
export function envelopeEncrypt(plaintext: number[], kek: number, dek: number): Envelope {\r
  return { ciphertext: cipher(plaintext, dek), wrappedDEK: cipher(num4(dek), kek) };\r
}\r
\r
/** Unwrap the DEK using the KEK (in the KMS, this is the only place the KEK exists). */\r
export const unwrapDEK = (wrappedDEK: number[], kek: number): number => bytes4(cipher(wrappedDEK, kek));\r
\r
/** Decrypt: unwrap the DEK with the KEK, then decrypt the data with the DEK. */\r
export function envelopeDecrypt(env: Envelope, kek: number): number[] {\r
  return cipher(env.ciphertext, unwrapDEK(env.wrappedDEK, kek));\r
}\r
\r
/** Rotate the master key: re-wrap the DEK under a new KEK. The ciphertext (the big data) is NEVER touched. */\r
export function rotateKEK(env: Envelope, oldKek: number, newKek: number): Envelope {\r
  const dek = unwrapDEK(env.wrappedDEK, oldKek);\r
  return { ciphertext: env.ciphertext, wrappedDEK: cipher(num4(dek), newKek) };\r
}\r
\r
export const bytes = (s: string): number[] => [...s].flatMap((c) => [...new TextEncoder().encode(c)]);\r
export const str = (b: number[]): string => new TextDecoder().decode(new Uint8Array(b));\r
`;export{e as default};