var e=`// The length-extension attack — why H(secret ‖ message) is a BROKEN message-authentication code, and why\r
// HMAC exists. Hashes in the Merkle–Damgård family (MD5, SHA-1, SHA-256) work by folding the message block by\r
// block into an internal state, and the final state IS the digest — nothing is hidden. So if a server proves\r
// authenticity with tag = H(secret ‖ message) and publishes the tag, an attacker who never learns the secret\r
// can still: (1) set the hash's internal state to the published tag, (2) append the message's padding "glue"\r
// plus any bytes they like, and (3) crank the compression function forward to get a VALID tag for\r
// message ‖ glue ‖ evil — a forgery. This really happened (e.g. Flickr's API signing). The fix is HMAC, which\r
// nests two hashes so the attacker never sees the raw internal state to continue from. This file implements a\r
// small but faithful Merkle–Damgård hash to demonstrate the attack end to end. Reference: RFC 2104 (HMAC);\r
// Ferguson & Schneier, "Practical Cryptography".\r
\r
const B = 8;               // block size in bytes\r
const IV = 0x811c9dc5;     // initial state (32-bit)\r
\r
export const strBytes = (s: string): number[] => [...s].flatMap((c) => [...new TextEncoder().encode(c)]);\r
export const hex = (state: number): string => (state >>> 0).toString(16).padStart(8, '0');\r
const stateBytes = (s: number): number[] => [(s >>> 24) & 0xff, (s >>> 16) & 0xff, (s >>> 8) & 0xff, s & 0xff];\r
\r
/** One compression step: fold an 8-byte block into the 32-bit state (FNV-style mix + rotate for avalanche). */\r
function compress(state: number, block: number[]): number {\r
  let h = state >>> 0;\r
  for (const b of block) { h = Math.imul(h ^ (b & 0xff), 0x01000193) >>> 0; h = ((h << 13) | (h >>> 19)) >>> 0; }\r
  return h >>> 0;\r
}\r
\r
/** Merkle–Damgård padding for a message of \`msgLen\` bytes: 0x80, zero-fill, then a 4-byte big-endian length,\r
 *  sized so the padded message is a whole number of blocks. This is the "glue" the attack reuses. */\r
export function mdPad(msgLen: number): number[] {\r
  const pad = [0x80];\r
  while ((msgLen + pad.length + 4) % B !== 0) pad.push(0x00);\r
  pad.push((msgLen >>> 24) & 0xff, (msgLen >>> 16) & 0xff, (msgLen >>> 8) & 0xff, msgLen & 0xff);\r
  return pad;\r
}\r
\r
function runBlocks(state: number, bytes: number[]): number {\r
  for (let i = 0; i < bytes.length; i += B) state = compress(state, bytes.slice(i, i + B));\r
  return state >>> 0;\r
}\r
\r
/** The hash: pad then absorb from the IV. Digest == final internal state (the whole vulnerability). */\r
export function hash(bytes: number[]): number {\r
  return runBlocks(IV, bytes.concat(mdPad(bytes.length)));\r
}\r
\r
/** The server's naive MAC — the thing that's broken. */\r
export const macNaive = (secret: number[], message: number[]): number => hash(secret.concat(message));\r
\r
/** The attack. Given only the tag of secret‖message and the length of secret‖message, forge a valid tag for\r
 *  message ‖ glue ‖ extension — WITHOUT the secret. Returns the forged tag and the suffix the server will see. */\r
export function extend(tag: number, secretPlusMsgLen: number, extension: number[]): { forgedTag: number; suffix: number[] } {\r
  const glue = mdPad(secretPlusMsgLen);                       // padding that was appended to secret‖message\r
  const newTotalLen = secretPlusMsgLen + glue.length + extension.length;\r
  // resume from the published tag as internal state; absorb extension + padding for the NEW total length\r
  const forgedTag = runBlocks(tag >>> 0, extension.concat(mdPad(newTotalLen)));\r
  return { forgedTag, suffix: glue.concat(extension) };       // server receives message ‖ (glue ‖ extension)\r
}\r
\r
/** HMAC — the fix. Nested hashing hides the inner internal state, so there's nothing to length-extend. */\r
export function hmac(key: number[], message: number[]): number {\r
  let k = key.length > B ? stateBytes(hash(key)) : key.slice();\r
  while (k.length < B) k.push(0);\r
  const ipad = k.map((b) => b ^ 0x36), opad = k.map((b) => b ^ 0x5c);\r
  const inner = hash(ipad.concat(message));\r
  return hash(opad.concat(stateBytes(inner)));\r
}\r
`;export{e as default};