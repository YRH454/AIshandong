var e=`// HKDF (RFC 5869) and the TLS 1.3 HKDF-Expand-Label (RFC 8446 §7.1), built on the\r
// from-scratch SHA-256 so we can show real, verifiable derivations. HKDF is two\r
// steps: EXTRACT condenses input keying material + a salt into a uniform pseudo-\r
// random key (PRK); EXPAND stretches the PRK into as many output bytes as needed,\r
// each block chained through HMAC. The HKDF/HMAC core is tested against the published RFC 5869 /\r
// RFC 4231 vectors; the TLS 1.3 Expand-Label layer follows RFC 8446 §7.1's encoding (its byte output\r
// is checked structurally, not pinned to an RFC 8448 trace).\r
import { sha256 } from './sha256';\r
\r
const BLOCK = 64; // SHA-256 block size\r
const HLEN = 32; // SHA-256 output size\r
\r
const concat = (...a: Uint8Array[]): Uint8Array => {\r
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));\r
  let o = 0;\r
  for (const x of a) { out.set(x, o); o += x.length; }\r
  return out;\r
};\r
\r
/** HMAC-SHA256 built on the local SHA-256 (so it works identically in tests). */\r
export function hmacSha256(key: Uint8Array, msg: Uint8Array): Uint8Array {\r
  let k = key;\r
  if (k.length > BLOCK) k = sha256(k);\r
  if (k.length < BLOCK) k = concat(k, new Uint8Array(BLOCK - k.length));\r
  const ipad = new Uint8Array(BLOCK);\r
  const opad = new Uint8Array(BLOCK);\r
  for (let i = 0; i < BLOCK; i++) { ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5c; }\r
  return sha256(concat(opad, sha256(concat(ipad, msg))));\r
}\r
\r
/** HKDF-Extract(salt, IKM) → PRK (RFC 5869 §2.2). */\r
export function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Uint8Array {\r
  return hmacSha256(salt.length ? salt : new Uint8Array(HLEN), ikm);\r
}\r
\r
/** HKDF-Expand(PRK, info, L) → L bytes of output keying material (RFC 5869 §2.3). */\r
export function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Uint8Array {\r
  if (length > 255 * HLEN) throw new Error('HKDF-Expand: length must be ≤ 255·HashLen (RFC 5869 §2.3)'); // else the 1-byte counter wraps\r
  const n = Math.ceil(length / HLEN);\r
  const out = new Uint8Array(n * HLEN);\r
  let prev: Uint8Array = Uint8Array.from([]);\r
  for (let i = 0; i < n; i++) {\r
    prev = Uint8Array.from(hmacSha256(prk, concat(prev, info, new Uint8Array([i + 1]))));\r
    out.set(prev, i * HLEN);\r
  }\r
  return out.slice(0, length);\r
}\r
\r
/**\r
 * HKDF-Expand-Label (RFC 8446 §7.1): the TLS 1.3 wrapper around HKDF-Expand whose\r
 * \`info\` is a structured HkdfLabel { length, "tls13 " + label, context }.\r
 */\r
export function hkdfExpandLabel(secret: Uint8Array, label: string, context: Uint8Array, length: number): Uint8Array {\r
  const full = new TextEncoder().encode('tls13 ' + label);\r
  const info = concat(\r
    new Uint8Array([(length >> 8) & 0xff, length & 0xff]),\r
    new Uint8Array([full.length]), full,\r
    new Uint8Array([context.length]), context,\r
  );\r
  return hkdfExpand(secret, info, length);\r
}\r
\r
/** Derive-Secret(secret, label, messages) (RFC 8446 §7.1): expand-label over a transcript hash. */\r
export function deriveSecret(secret: Uint8Array, label: string, transcript: Uint8Array): Uint8Array {\r
  return hkdfExpandLabel(secret, label, sha256(transcript), HLEN);\r
}\r
\r
export { hex as toHex } from './bytes';\r
\r
// ---- The TLS 1.3 key schedule (RFC 8446 §7.1), as a derivation tree ----------\r
\r
export interface KsNode {\r
  id: string;\r
  label: string; // human name\r
  kind: 'input' | 'extract' | 'derive' | 'secret' | 'key';\r
  value: Uint8Array;\r
  via: string; // the HKDF step that produced it\r
  from: string[]; // parent node ids\r
  note: string;\r
}\r
\r
const ZERO = new Uint8Array(HLEN);\r
\r
/**\r
 * Build the (EC)DHE-only key schedule from a shared (EC)DHE secret, using an empty\r
 * transcript (sandbox values only — never a captured handshake). Returns the nodes\r
 * of the derivation tree in dependency order.\r
 */\r
export function tls13KeySchedule(ecdheSecret: Uint8Array): KsNode[] {\r
  const emptyMsgs = new Uint8Array(0);\r
\r
  const earlySecret = hkdfExtract(new Uint8Array(0), ZERO); // PSK = 0\r
  const derivedForHs = deriveSecret(earlySecret, 'derived', emptyMsgs);\r
  const handshakeSecret = hkdfExtract(derivedForHs, ecdheSecret);\r
  const cHsTraffic = deriveSecret(handshakeSecret, 'c hs traffic', emptyMsgs);\r
  const sHsTraffic = deriveSecret(handshakeSecret, 's hs traffic', emptyMsgs);\r
  const derivedForMaster = deriveSecret(handshakeSecret, 'derived', emptyMsgs);\r
  const masterSecret = hkdfExtract(derivedForMaster, ZERO);\r
  const cAppTraffic = deriveSecret(masterSecret, 'c ap traffic', emptyMsgs);\r
  const sAppTraffic = deriveSecret(masterSecret, 's ap traffic', emptyMsgs);\r
  const cKey = hkdfExpandLabel(cAppTraffic, 'key', emptyMsgs, 16); // AES-128 key\r
  const cIv = hkdfExpandLabel(cAppTraffic, 'iv', emptyMsgs, 12); // 96-bit nonce\r
\r
  return [\r
    { id: 'ikm0', label: 'PSK = 0', kind: 'input', value: ZERO, via: 'all-zero (no PSK)', from: [], note: 'With no pre-shared key, the early-secret input keying material is a string of zeros.' },\r
    { id: 'early', label: 'Early Secret', kind: 'extract', value: earlySecret, via: 'HKDF-Extract(0, PSK)', from: ['ikm0'], note: 'The root of the schedule. Without 0-RTT, nothing else is derived from it yet except the "derived" salt.' },\r
    { id: 'derived-hs', label: 'Derived (for Handshake)', kind: 'derive', value: derivedForHs, via: 'Derive-Secret(Early, "derived", "")', from: ['early'], note: 'A salt for the next Extract, bound to the empty transcript.' },\r
    { id: 'ecdhe', label: '(EC)DHE shared secret', kind: 'input', value: ecdheSecret, via: 'from key_share exchange', from: [], note: 'The ephemeral Diffie-Hellman secret both sides computed from the ClientHello/ServerHello key_shares.' },\r
    { id: 'handshake', label: 'Handshake Secret', kind: 'extract', value: handshakeSecret, via: 'HKDF-Extract(Derived, (EC)DHE)', from: ['derived-hs', 'ecdhe'], note: 'Mixes in the (EC)DHE secret — this is where forward secrecy enters. Everything in the handshake is keyed from here.' },\r
    { id: 'c-hs', label: 'client handshake traffic', kind: 'secret', value: cHsTraffic, via: 'Derive-Secret(Handshake, "c hs traffic", …)', from: ['handshake'], note: 'Protects the client→server handshake messages (e.g. the client Finished).' },\r
    { id: 's-hs', label: 'server handshake traffic', kind: 'secret', value: sHsTraffic, via: 'Derive-Secret(Handshake, "s hs traffic", …)', from: ['handshake'], note: 'Protects the server→client handshake messages (EncryptedExtensions … Finished).' },\r
    { id: 'derived-ms', label: 'Derived (for Master)', kind: 'derive', value: derivedForMaster, via: 'Derive-Secret(Handshake, "derived", "")', from: ['handshake'], note: 'Salt for the final Extract that yields the master secret.' },\r
    { id: 'master', label: 'Master Secret', kind: 'extract', value: masterSecret, via: 'HKDF-Extract(Derived, 0)', from: ['derived-ms'], note: 'The application-data root. No new entropy is added here — just a clean Extract.' },\r
    { id: 'c-ap', label: 'client application traffic', kind: 'secret', value: cAppTraffic, via: 'Derive-Secret(Master, "c ap traffic", …)', from: ['master'], note: 'Keys the client’s application data after the handshake completes.' },\r
    { id: 's-ap', label: 'server application traffic', kind: 'secret', value: sAppTraffic, via: 'Derive-Secret(Master, "s ap traffic", …)', from: ['master'], note: 'Keys the server’s application data.' },\r
    { id: 'c-key', label: 'client write key (AES-128)', kind: 'key', value: cKey, via: 'HKDF-Expand-Label(c ap, "key", "", 16)', from: ['c-ap'], note: 'The actual 16-byte AES-GCM key for client records.' },\r
    { id: 'c-iv', label: 'client write IV (96-bit)', kind: 'key', value: cIv, via: 'HKDF-Expand-Label(c ap, "iv", "", 12)', from: ['c-ap'], note: 'The 12-byte nonce base, XORed with the record sequence number per record.' },\r
  ];\r
}\r
`;export{e as default};