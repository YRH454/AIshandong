var e=`// ChaCha20 (RFC 8439) — the stream cipher behind TLS's ChaCha20-Poly1305, fast in\r
// software without AES hardware. It builds a 64-byte keystream block by stirring a\r
// 4×4 matrix of 32-bit words (constants ‖ key ‖ counter ‖ nonce) through 20 rounds\r
// of ARX quarter-rounds (add, rotate, xor), then adds the original state back and\r
// XORs the result over the data. Verified against the RFC 8439 test vectors.\r
\r
const rotl = (v: number, n: number) => ((v << n) | (v >>> (32 - n))) >>> 0;\r
\r
/** The ChaCha quarter-round on four words (pure form, for the §2.1.1 vector). */\r
export function quarterRound(a: number, b: number, c: number, d: number): [number, number, number, number] {\r
  a = (a + b) >>> 0; d = rotl(d ^ a, 16);\r
  c = (c + d) >>> 0; b = rotl(b ^ c, 12);\r
  a = (a + b) >>> 0; d = rotl(d ^ a, 8);\r
  c = (c + d) >>> 0; b = rotl(b ^ c, 7);\r
  return [a, b, c, d];\r
}\r
\r
function qr(s: Uint32Array, a: number, b: number, c: number, d: number) {\r
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 16);\r
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 12);\r
  s[a] = (s[a] + s[b]) >>> 0; s[d] = rotl(s[d] ^ s[a], 8);\r
  s[c] = (s[c] + s[d]) >>> 0; s[b] = rotl(s[b] ^ s[c], 7);\r
}\r
\r
const CONSTANTS = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]; // "expand 32-byte k"\r
\r
const leWord = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;\r
\r
/** Build the initial 16-word state for a (key, counter, nonce). */\r
export function chachaState(key: Uint8Array, counter: number, nonce: Uint8Array): Uint32Array {\r
  const s = new Uint32Array(16);\r
  s.set(CONSTANTS, 0);\r
  for (let i = 0; i < 8; i++) s[4 + i] = leWord(key, i * 4);\r
  s[12] = counter >>> 0;\r
  for (let i = 0; i < 3; i++) s[13 + i] = leWord(nonce, i * 4);\r
  return s;\r
}\r
\r
export interface ChachaBlock {\r
  state: Uint32Array; // the initial state\r
  rounds: Uint32Array[]; // working state after each of the 10 double-rounds\r
  out: Uint32Array; // state after adding the original back (pre-serialise)\r
  keystream: Uint8Array; // 64 bytes, little-endian\r
}\r
\r
/** One 64-byte ChaCha20 block, with a snapshot after every double-round. */\r
export function chacha20Block(key: Uint8Array, counter: number, nonce: Uint8Array): ChachaBlock {\r
  const state = chachaState(key, counter, nonce);\r
  const x = state.slice();\r
  const rounds: Uint32Array[] = [];\r
  for (let i = 0; i < 10; i++) {\r
    qr(x, 0, 4, 8, 12); qr(x, 1, 5, 9, 13); qr(x, 2, 6, 10, 14); qr(x, 3, 7, 11, 15); // columns\r
    qr(x, 0, 5, 10, 15); qr(x, 1, 6, 11, 12); qr(x, 2, 7, 8, 13); qr(x, 3, 4, 9, 14); // diagonals\r
    rounds.push(x.slice());\r
  }\r
  const out = new Uint32Array(16);\r
  for (let i = 0; i < 16; i++) out[i] = (x[i] + state[i]) >>> 0;\r
  const keystream = new Uint8Array(64);\r
  for (let i = 0; i < 16; i++) {\r
    keystream[i * 4] = out[i] & 0xff;\r
    keystream[i * 4 + 1] = (out[i] >>> 8) & 0xff;\r
    keystream[i * 4 + 2] = (out[i] >>> 16) & 0xff;\r
    keystream[i * 4 + 3] = (out[i] >>> 24) & 0xff;\r
  }\r
  return { state, rounds, out, keystream };\r
}\r
\r
/** Encrypt/decrypt: XOR the per-block keystream over the data (counter increments). */\r
export function chacha20(data: Uint8Array, key: Uint8Array, counter: number, nonce: Uint8Array): Uint8Array {\r
  const out = new Uint8Array(data.length);\r
  for (let off = 0; off < data.length; off += 64) {\r
    const ks = chacha20Block(key, counter + (off >> 6), nonce).keystream;\r
    const n = Math.min(64, data.length - off);\r
    for (let j = 0; j < n; j++) out[off + j] = data[off + j] ^ ks[j];\r
  }\r
  return out;\r
}\r
\r
export const hexWord = (w: number) => (w >>> 0).toString(16).padStart(8, '0');\r
`;export{e as default};