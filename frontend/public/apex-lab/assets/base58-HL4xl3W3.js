var e=`// Base58 & Base58Check — the encoding behind Bitcoin addresses, WIF private keys, and IPFS content IDs. It turns\r
// arbitrary bytes into a string, like Base64, but with two deliberate differences. First, the alphabet omits the\r
// four characters that look alike in most fonts — 0 (zero), O (capital o), I (capital i), and l (lowercase L) —\r
// plus + and / — so a human can read an address aloud or copy it by hand without ambiguity. That leaves 58\r
// symbols. Second, and more subtly: because 58 is NOT a power of two, you can't slice the input into fixed\r
// bit-groups the way Base64 chunks 6 bits at a time. Instead Base58 treats the whole byte string as one big\r
// base-256 integer and repeatedly divides by 58, reading off remainders — a genuine base conversion. A\r
// consequence is that encoding has no clean byte-to-char ratio and is a touch slower, but the output has no\r
// padding and no line-noise characters. Leading zero bytes are a special case (they'd vanish in the bignum), so\r
// each is encoded as a literal '1' (the 0th alphabet symbol). Base58CHECK wraps this for addresses: prepend a\r
// version byte (0x00 = Bitcoin mainnet P2PKH), append a 4-byte checksum = the first 4 bytes of SHA256(SHA256(\r
// version‖payload)), and Base58-encode the whole thing. On decode you re-hash and compare those 4 bytes, so a\r
// single mistyped character is caught with ~1 - 2^-32 probability before any money moves. This models the\r
// bignum conversion, leading-zero handling, and the real double-SHA256 checksum. Reference: Bitcoin base58check;\r
// Satoshi's original encoder.\r
\r
import { sha256 } from './hashing';\r
\r
export const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; // no 0 O I l\r
const MAP = new Map([...ALPHABET].map((c, i) => [c, i]));\r
\r
/** Encode bytes as Base58 (big-endian bignum, base-256 → base-58, leading zeros → '1'). */\r
export function encode(bytes: Uint8Array): string {\r
  let num = 0n;\r
  for (const b of bytes) num = num * 256n + BigInt(b);\r
  let out = '';\r
  while (num > 0n) { out = ALPHABET[Number(num % 58n)] + out; num /= 58n; }\r
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; } // preserve leading zero bytes\r
  return out;\r
}\r
\r
/** Decode Base58 back to bytes. Throws on an out-of-alphabet character. */\r
export function decode(str: string): Uint8Array {\r
  let num = 0n;\r
  for (const c of str) { const v = MAP.get(c); if (v === undefined) throw new Error(\`invalid base58 char '\${c}'\`); num = num * 58n + BigInt(v); }\r
  const bytes: number[] = [];\r
  while (num > 0n) { bytes.unshift(Number(num % 256n)); num /= 256n; }\r
  for (const c of str) { if (c === '1') bytes.unshift(0); else break; } // leading '1' → leading zero byte\r
  return new Uint8Array(bytes);\r
}\r
\r
import { concatBytes as concat } from './bytes';\r
const sha256d = async (b: Uint8Array): Promise<Uint8Array> => sha256(await sha256(b));\r
\r
/** Base58Check-encode: version ‖ payload ‖ first4(SHA256d(version‖payload)). */\r
export async function encodeCheck(version: number, payload: Uint8Array): Promise<string> {\r
  const data = concat(new Uint8Array([version]), payload);\r
  const checksum = (await sha256d(data)).slice(0, 4);\r
  return encode(concat(data, checksum));\r
}\r
\r
export interface CheckResult { version: number; payload: Uint8Array; valid: boolean; checksum: Uint8Array; expected: Uint8Array }\r
\r
/** Decode and verify a Base58Check string (re-hash and compare the 4-byte checksum). */\r
export async function decodeCheck(str: string): Promise<CheckResult> {\r
  const full = decode(str);\r
  const data = full.slice(0, -4), checksum = full.slice(-4);\r
  const expected = (await sha256d(data)).slice(0, 4);\r
  const valid = checksum.length === 4 && expected.every((b, i) => b === checksum[i]);\r
  return { version: data[0], payload: data.slice(1), valid, checksum, expected };\r
}\r
\r
export { hex as toHex } from './bytes';\r
export const fromHex = (h: string): Uint8Array => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));\r
`;export{e as default};