var e=`// Real cryptographic hashing for the Cryptography section, via WebCrypto. The\r
// "bytes are real" creed: these compute genuine SHA-256 / HMAC-SHA-256 and are\r
// tested against published vectors (NIST FIPS 180-4, RFC 4231). Sandbox values\r
// only — never a captured stream.\r
\r
/** SHA-256 of bytes → 32-byte digest. */\r
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {\r
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto (crypto.subtle) is unavailable here.');\r
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;\r
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));\r
}\r
\r
/** HMAC-SHA-256 of message under key → 32-byte MAC. */\r
export async function hmacSha256(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {\r
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto (crypto.subtle) is unavailable here.');\r
  const k = await crypto.subtle.importKey(\r
    'raw',\r
    key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,\r
    { name: 'HMAC', hash: 'SHA-256' },\r
    false,\r
    ['sign'],\r
  );\r
  const m = msg.buffer.slice(msg.byteOffset, msg.byteOffset + msg.byteLength) as ArrayBuffer;\r
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, m));\r
}\r
\r
/** Count differing bits between two byte arrays (the Hamming distance). */\r
export function bitDifference(a: Uint8Array, b: Uint8Array): number {\r
  const n = Math.min(a.length, b.length);\r
  let bits = 0;\r
  for (let i = 0; i < n; i++) {\r
    let x = a[i] ^ b[i];\r
    while (x) { bits += x & 1; x >>= 1; }\r
  }\r
  return bits;\r
}\r
\r
/** Lowercase hex of bytes (no separators). */\r
export function toHex(bytes: Uint8Array): string {\r
  return [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('');\r
}\r
\r
/** Flip a single bit (bitIndex counts MSB-first within the byte) of a copy. */\r
export function flipBit(bytes: Uint8Array, byteIndex: number, bitIndex: number): Uint8Array {\r
  const out = bytes.slice();\r
  out[byteIndex] ^= 0x80 >> bitIndex;\r
  return out;\r
}\r
`;export{e as default};