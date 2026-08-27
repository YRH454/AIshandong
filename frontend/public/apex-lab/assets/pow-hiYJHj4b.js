var e=`// Proof of Work (Hashcash, and the heart of Bitcoin mining). A hash is a one-way\r
// random-looking function, so the only way to find an input whose hash starts with d\r
// zero BITS is to try ~2^d inputs. That makes work measurable and forgery expensive:\r
// to rewrite a block you'd have to redo its proof and every block after it. Real\r
// SHA-256 from sha256.ts (verified to NIST), so every hash here is genuine. We grind\r
// a nonce until the digest clears the difficulty target.\r
import { sha256, concatBytes } from './sha256';\r
\r
/** Number of leading zero BITS in a digest. */\r
export function leadingZeroBits(h: Uint8Array): number {\r
  let bits = 0;\r
  for (const byte of h) {\r
    if (byte === 0) { bits += 8; continue; }\r
    for (let m = 7; m >= 0; m--) { if ((byte >> m) & 1) return bits; bits++; }\r
    break;\r
  }\r
  return bits;\r
}\r
\r
export interface Mined {\r
  found: boolean;\r
  nonce: number;\r
  hash: Uint8Array;\r
  tries: number;\r
  zeroBits: number;\r
}\r
\r
const enc = (s: string) => new TextEncoder().encode(s);\r
\r
/** Grind nonces from \`start\` until sha256(data ‖ nonce) has ≥ \`difficulty\` leading\r
 *  zero bits, or \`maxTries\` is reached. Deterministic: nonces increase from \`start\`. */\r
export function mine(data: string, difficulty: number, maxTries: number, start = 0): Mined {\r
  const base = enc(data);\r
  for (let nonce = start; nonce < start + maxTries; nonce++) {\r
    const hash = sha256(concatBytes(base, enc(String(nonce))));\r
    const z = leadingZeroBits(hash);\r
    if (z >= difficulty) return { found: true, nonce, hash, tries: nonce - start + 1, zeroBits: z };\r
  }\r
  const lastNonce = start + maxTries - 1;\r
  return { found: false, nonce: lastNonce, hash: sha256(concatBytes(base, enc(String(lastNonce)))), tries: maxTries, zeroBits: 0 };\r
}\r
\r
/** Verify a claimed nonce really clears the target (what every other node does). */\r
export function verify(data: string, nonce: number, difficulty: number): boolean {\r
  return leadingZeroBits(sha256(concatBytes(enc(data), enc(String(nonce))))) >= difficulty;\r
}\r
\r
export const expectedTries = (difficulty: number): number => Math.pow(2, difficulty);\r
`;export{e as default};