var e=`// HOTP (RFC 4226) and TOTP (RFC 6238) — the math behind the 6-digit codes in\r
// Google Authenticator / Authy. HOTP truncates an HMAC-SHA1 to a few decimal\r
// digits; TOTP is just HOTP with a time-based counter (unix time / 30s). Tested\r
// against the published RFC test vectors. Real HMAC via WebCrypto.\r
\r
const ab = (b: Uint8Array): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;\r
\r
async function hmacSha1(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {\r
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto unavailable.');\r
  const k = await crypto.subtle.importKey('raw', ab(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);\r
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, ab(msg)));\r
}\r
\r
export interface HotpTrace {\r
  code: string;\r
  counterBytes: Uint8Array; // the 8-byte big-endian counter\r
  hmac: Uint8Array; // 20-byte HMAC-SHA1\r
  offset: number; // dynamic-truncation offset (last nibble)\r
  binary: number; // 31-bit truncated value\r
}\r
\r
/** HOTP (RFC 4226): dynamic-truncation of HMAC-SHA1(secret, counter). */\r
export async function hotpTrace(secret: Uint8Array, counter: number, digits = 6): Promise<HotpTrace> {\r
  const counterBytes = new Uint8Array(8);\r
  let c = BigInt(counter);\r
  for (let i = 7; i >= 0; i--) { counterBytes[i] = Number(c & 0xffn); c >>= 8n; }\r
  const hmac = await hmacSha1(secret, counterBytes);\r
  const offset = hmac[hmac.length - 1] & 0x0f;\r
  const binary = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];\r
  const code = (binary % 10 ** digits).toString().padStart(digits, '0');\r
  return { code, counterBytes, hmac, offset, binary };\r
}\r
\r
export async function hotp(secret: Uint8Array, counter: number, digits = 6): Promise<string> {\r
  return (await hotpTrace(secret, counter, digits)).code;\r
}\r
\r
/** TOTP (RFC 6238): HOTP over the time-step counter floor(unixSeconds / step). */\r
export async function totp(secret: Uint8Array, unixSeconds: number, step = 30, digits = 6): Promise<string> {\r
  return hotp(secret, Math.floor(unixSeconds / step), digits);\r
}\r
\r
// ---- base32 (RFC 4648) — how authenticator secrets are written --------------\r
\r
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';\r
\r
/** Decode an RFC 4648 base32 string (the format in otpauth:// URIs) to bytes. */\r
export function base32Decode(s: string): Uint8Array {\r
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\\s/g, '');\r
  let bits = 0, value = 0;\r
  const out: number[] = [];\r
  for (const ch of clean) {\r
    const idx = B32.indexOf(ch);\r
    if (idx < 0) continue;\r
    value = (value << 5) | idx;\r
    bits += 5;\r
    if (bits >= 8) { bits -= 8; out.push((value >> bits) & 0xff); }\r
  }\r
  return new Uint8Array(out);\r
}\r
`;export{e as default};