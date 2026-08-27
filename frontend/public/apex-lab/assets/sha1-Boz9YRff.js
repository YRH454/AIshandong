var e=`// SHA-1 (FIPS 180-4) — implemented from scratch so the "broken hashes" section can\r
// show it really computing, and verified to the NIST vectors. SHA-1 is cryptographically\r
// DEAD: the 2017 SHAttered attack produced two different PDFs with the same SHA-1\r
// (≈2^63 work, far below the 2^80 a 160-bit hash should need), and the 2020 "Shambles"\r
// attack made chosen-prefix collisions practical. Computing it is fine; trusting it\r
// for signatures, certs, or git integrity is not. Reuses the Merkle–Damgård padding.\r
import { mdPadding, concatBytes } from './sha256';\r
\r
const rotl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;\r
\r
export function sha1(msg: Uint8Array): Uint8Array {\r
  const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];\r
  const buf = concatBytes(msg, mdPadding(msg.length, msg.length));\r
  const w = new Uint32Array(80);\r
  for (let off = 0; off < buf.length; off += 64) {\r
    for (let i = 0; i < 16; i++) w[i] = ((buf[off + 4 * i] << 24) | (buf[off + 4 * i + 1] << 16) | (buf[off + 4 * i + 2] << 8) | buf[off + 4 * i + 3]) >>> 0;\r
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);\r
    let [a, b, c, d, e] = H;\r
    for (let i = 0; i < 80; i++) {\r
      let f: number, k: number;\r
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }\r
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }\r
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }\r
      else { f = b ^ c ^ d; k = 0xca62c1d6; }\r
      const t = (rotl(a, 5) + f + e + k + w[i]) >>> 0;\r
      e = d; d = c; c = rotl(b, 30); b = a; a = t;\r
    }\r
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0;\r
  }\r
  const out = new Uint8Array(20);\r
  for (let i = 0; i < 5; i++) { out[4 * i] = H[i] >>> 24; out[4 * i + 1] = (H[i] >>> 16) & 0xff; out[4 * i + 2] = (H[i] >>> 8) & 0xff; out[4 * i + 3] = H[i] & 0xff; }\r
  return out;\r
}\r
`;export{e as default};