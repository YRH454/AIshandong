var e=`// Password-based key derivation (PBKDF2) via WebCrypto. The point a developer\r
// must internalise: never store a raw hash of a password. PBKDF2 adds a per-user\r
// SALT (defeats precomputed rainbow tables) and a high ITERATION count (a "work\r
// factor" that makes brute force expensive). Tested against RFC 6070 vectors.\r
\r
type Hash = 'SHA-1' | 'SHA-256' | 'SHA-512';\r
\r
const ab = (b: Uint8Array): ArrayBuffer =>\r
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;\r
\r
/** PBKDF2 → dkLen-byte derived key. */\r
export async function pbkdf2(\r
  password: Uint8Array,\r
  salt: Uint8Array,\r
  iterations: number,\r
  hash: Hash,\r
  dkLenBytes: number,\r
): Promise<Uint8Array> {\r
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto (crypto.subtle) is unavailable here.');\r
  const key = await crypto.subtle.importKey('raw', ab(password), 'PBKDF2', false, ['deriveBits']);\r
  const bits = await crypto.subtle.deriveBits(\r
    { name: 'PBKDF2', salt: ab(salt), iterations, hash },\r
    key,\r
    dkLenBytes * 8,\r
  );\r
  return new Uint8Array(bits);\r
}\r
\r
export { hex as toHex } from './bytes';\r
`;export{e as default};