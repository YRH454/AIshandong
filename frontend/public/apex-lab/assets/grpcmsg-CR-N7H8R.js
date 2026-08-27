var e=`// gRPC on the wire — Protocol Buffers framed inside HTTP/2. A protobuf message is a\r
// flat sequence of fields, each a tag (field-number<<3 | wire-type) then the value;\r
// integers are varints (base-128, little-endian, high bit = "more bytes"), strings are\r
// length-delimited. gRPC then prefixes each message with a 1-byte compressed flag and a\r
// 4-byte big-endian length, and carries it in HTTP/2 DATA frames. Real encoding,\r
// verified against the canonical protobuf examples.\r
\r
/** Base-128 varint, little-endian, MSB = continuation. */\r
export function varint(n: number): number[] {\r
  const out: number[] = [];\r
  let v = n >>> 0;\r
  do { let b = v & 0x7f; v >>>= 7; if (v) b |= 0x80; out.push(b); } while (v);\r
  return out;\r
}\r
\r
export type FieldType = 'int' | 'string';\r
export interface ProtoField { field: number; type: FieldType; value: number | string }\r
\r
export interface EncodedField {\r
  field: number;\r
  wireType: number; // 0 = varint, 2 = length-delimited\r
  tagByte: number;\r
  lenBytes: number[]; // length varint for strings (empty for ints)\r
  valueBytes: number[];\r
  bytes: number[]; // tag ‖ len ‖ value\r
}\r
\r
export function encodeField(f: ProtoField): EncodedField {\r
  if (f.type === 'int') {\r
    const tagByte = (f.field << 3) | 0;\r
    const valueBytes = varint(Number(f.value));\r
    return { field: f.field, wireType: 0, tagByte, lenBytes: [], valueBytes, bytes: [tagByte, ...valueBytes] };\r
  }\r
  const tagByte = (f.field << 3) | 2;\r
  const valueBytes = [...new TextEncoder().encode(String(f.value))];\r
  const lenBytes = varint(valueBytes.length);\r
  return { field: f.field, wireType: 2, tagByte, lenBytes, valueBytes, bytes: [tagByte, ...lenBytes, ...valueBytes] };\r
}\r
\r
export function encodeMessage(fields: ProtoField[]): { fields: EncodedField[]; bytes: Uint8Array } {\r
  const enc = fields.map(encodeField);\r
  return { fields: enc, bytes: Uint8Array.from(enc.flatMap((e) => e.bytes)) };\r
}\r
\r
/** gRPC length-prefixed framing: [compressed flag][4-byte big-endian length][message]. */\r
export function grpcFrame(msg: Uint8Array): Uint8Array {\r
  const out = new Uint8Array(5 + msg.length);\r
  out[0] = 0; // not compressed\r
  out[1] = (msg.length >>> 24) & 0xff;\r
  out[2] = (msg.length >>> 16) & 0xff;\r
  out[3] = (msg.length >>> 8) & 0xff;\r
  out[4] = msg.length & 0xff;\r
  out.set(msg, 5);\r
  return out;\r
}\r
\r
export const wireName = (w: number): string => (w === 0 ? 'varint' : w === 2 ? 'len-delimited' : \`wire \${w}\`);\r
`;export{e as default};