var e=`// HMAC — prove a message came from someone holding a shared secret and wasn't tampered with (TLS, JWT, API\r
// signing, webhooks). The naive MAC = H(key ‖ msg) is broken by a LENGTH-EXTENSION attack: for Merkle-Damgård\r
// hashes (MD5, SHA-1, SHA-256) the digest IS the internal state after msg, so anyone who sees H(key ‖ msg) can\r
// extend it to a valid MAC for msg ‖ padding ‖ more, without the key. HMAC hashes twice with two key-derived pads:\r
//     HMAC(K, m) = H((K ⊕ opad) ‖ H((K ⊕ ipad) ‖ m))\r
// (ipad = 0x36 and opad = 0x5c repeated to the block size; K zero-padded, or hashed first if longer, to 64 bytes\r
// for SHA-256). The attacker only ever sees the OUTER hash of a fixed-length inner digest, so there is nothing to\r
// length-extend. This is provably secure given a decent hash, which is why HMAC, not raw keyed hashing, is the\r
// standard even with SHA-256. Built here from the two passes on real SHA-256, exposing the intermediate values\r
// and checked against the platform's HMAC. Refs: RFC 2104; RFC 4231 (HMAC-SHA-256 vectors); Bellare et al.\r
\r
import { sha256 } from './hashing';\r
\r
const BLOCK = 64; // SHA-256 block size in bytes\r
\r
import { concatBytes as concat } from './bytes';\r
const xorPad = (k0: Uint8Array, pad: number): Uint8Array => k0.map((b) => b ^ pad);\r
\r
export interface HmacSteps { blockKey: Uint8Array; ipadKey: Uint8Array; opadKey: Uint8Array; inner: Uint8Array; mac: Uint8Array; keyWasHashed: boolean }\r
\r
/** Compute HMAC-SHA256, returning the tag and every intermediate value for visualization. */\r
export async function hmac(key: Uint8Array, msg: Uint8Array): Promise<HmacSteps> {\r
  const keyWasHashed = key.length > BLOCK;\r
  let k = keyWasHashed ? await sha256(key) : key;   // shorten an over-long key by hashing it\r
  const blockKey = new Uint8Array(BLOCK);\r
  blockKey.set(k);                                   // zero-pad up to the block size\r
  const ipadKey = xorPad(blockKey, 0x36);\r
  const opadKey = xorPad(blockKey, 0x5c);\r
  const inner = await sha256(concat(ipadKey, msg));  // inner hash: H((K⊕ipad) ‖ m)\r
  const mac = await sha256(concat(opadKey, inner));  // outer hash: H((K⊕opad) ‖ inner)\r
  return { blockKey, ipadKey, opadKey, inner, mac, keyWasHashed };\r
}\r
\r
/** The broken naive MAC = H(key ‖ msg), shown for contrast (length-extension forgeable). */\r
export async function naiveMac(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {\r
  return sha256(concat(key, msg));\r
}\r
\r
export { hex, enc } from './bytes';\r
export const fromHex = (h: string): Uint8Array => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));\r
`;export{e as default};