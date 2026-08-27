var e=`// Varint & zigzag — how Protocol Buffers (and gRPC, and many wire formats) pack integers compactly. A\r
// fixed int64 always costs 8 bytes even to store the number 3. A VARINT (LEB128) instead uses 7 bits of\r
// each byte for data and the top bit as a CONTINUATION flag: 1 = "more bytes follow", 0 = "last byte",\r
// little-endian groups. So 0–127 fit in one byte, 128–16383 in two, and you only pay for the magnitude you\r
// actually use. The catch: a NEGATIVE number, two's-complement-extended to 64 bits, is all high bits — it\r
// balloons to the full 10 bytes. ZIGZAG fixes that by interleaving signs (0,-1,1,-2,2 → 0,1,2,3,4) so a\r
// small-magnitude negative stays small. This is exactly why proto3 has sint32/sint64. Reference: Protocol\r
// Buffers encoding spec; LEB128.\r
\r
/** Encode a non-negative integer as an unsigned LEB128 varint (low 7-bit group first). */\r
export function encodeVarint(n: number): number[] {\r
  if (n < 0 || !Number.isFinite(n)) throw new Error('encodeVarint expects a non-negative integer');\r
  const out: number[] = [];\r
  do {\r
    let b = n % 128;\r
    n = Math.floor(n / 128);\r
    if (n > 0) b |= 0x80; // set the continuation bit on every byte but the last\r
    out.push(b);\r
  } while (n > 0);\r
  return out;\r
}\r
\r
/** Decode an unsigned varint starting at \`offset\`; returns the value and how many bytes it consumed. */\r
export function decodeVarint(bytes: number[], offset = 0): { value: number; bytesRead: number } {\r
  let value = 0, mult = 1, i = offset;\r
  for (; i < bytes.length; i++) {\r
    const b = bytes[i];\r
    value += (b & 0x7f) * mult; // little-endian: each group is more significant\r
    mult *= 128;\r
    if ((b & 0x80) === 0) return { value, bytesRead: i - offset + 1 }; // continuation clear → done\r
  }\r
  throw new Error('truncated varint (continuation bit set on the last byte)');\r
}\r
\r
/** ZigZag: map a signed integer to a non-negative one so small magnitudes (±) stay small. 0,-1,1,-2,2 → 0,1,2,3,4. */\r
export const zigzagEncode = (n: number): number => (n >= 0 ? n * 2 : -n * 2 - 1);\r
export const zigzagDecode = (u: number): number => (u % 2 === 0 ? u / 2 : -(u + 1) / 2);\r
\r
/** Encode a signed integer the way proto3 int32/int64 do WITHOUT zigzag: two's-complement to 64 bits first.\r
 *  A negative value becomes all-high-bits → the full 10-byte varint (the gotcha zigzag/sintN avoids). */\r
export function encodeVarintSigned64(n: number): number[] {\r
  let v = BigInt(Math.trunc(n));\r
  if (v < 0n) v += 1n << 64n; // 64-bit two's complement\r
  const out: number[] = [];\r
  do {\r
    let b = Number(v & 0x7fn);\r
    v >>= 7n;\r
    if (v > 0n) b |= 0x80;\r
    out.push(b);\r
  } while (v > 0n);\r
  return out;\r
}\r
`;export{e as default};