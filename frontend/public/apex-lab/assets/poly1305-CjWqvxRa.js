var e=`// Poly1305 (RFC 8439 §2.5) — the one-time authenticator paired with ChaCha20. It's a\r
// polynomial evaluated in the prime field 2¹³⁰−5: chop the message into 16-byte\r
// coefficients, each gets a high "1" bit appended, and accumulate acc = (acc + block)·r\r
// mod p, then add s and truncate to 128 bits. The key (r, s) must be UNIQUE per message\r
// (in ChaCha20-Poly1305 it's the cipher's first keystream block) — reuse and the MAC\r
// is forgeable, the same nonce-reuse lesson again. Real BigInt math, verified to the\r
// RFC test vector.\r
\r
const P = (1n << 130n) - 5n;\r
const CLAMP = 0x0ffffffc0ffffffc0ffffffc0fffffffn;\r
\r
const leNum = (bytes: Uint8Array): bigint => {\r
  let n = 0n;\r
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]);\r
  return n;\r
};\r
\r
export interface PolyStep { block: number; coeff: bigint; acc: bigint }\r
\r
export interface PolyResult { r: bigint; s: bigint; tag: Uint8Array; steps: PolyStep[] }\r
\r
/** Compute the Poly1305 tag of \`msg\` under the 32-byte one-time key. */\r
export function poly1305(msg: Uint8Array, key: Uint8Array): PolyResult {\r
  const r = leNum(key.subarray(0, 16)) & CLAMP; // clamp r\r
  const s = leNum(key.subarray(16, 32));\r
  let acc = 0n;\r
  const steps: PolyStep[] = [];\r
  for (let off = 0, b = 0; off < msg.length; off += 16, b++) {\r
    const chunk = msg.subarray(off, off + 16);\r
    const coeff = leNum(chunk) + (1n << BigInt(8 * chunk.length)); // append the high 1 bit\r
    acc = ((acc + coeff) * r) % P;\r
    steps.push({ block: b, coeff, acc });\r
  }\r
  acc = (acc + s) % (1n << 128n); // add s, truncate to 128 bits\r
  const tag = new Uint8Array(16);\r
  let t = acc;\r
  for (let i = 0; i < 16; i++) { tag[i] = Number(t & 0xffn); t >>= 8n; }\r
  return { r, s, tag, steps };\r
}\r
\r
/** Constant-ish compare the receiver uses to accept/reject. */\r
export function verify(msg: Uint8Array, key: Uint8Array, tag: Uint8Array): boolean {\r
  const got = poly1305(msg, key).tag;\r
  let d = 0;\r
  for (let i = 0; i < 16; i++) d |= got[i] ^ (tag[i] ?? 0xff ^ got[i]);\r
  return d === 0 && tag.length === 16;\r
}\r
`;export{e as default};