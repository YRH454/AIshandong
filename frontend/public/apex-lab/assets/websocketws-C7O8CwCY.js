var e=`// WebSocket (RFC 6455) — upgrading a plain HTTP connection into a full-duplex,\r
// message-framed channel. The client sends an HTTP GET with Upgrade: websocket and a\r
// random Sec-WebSocket-Key; the server proves it speaks WebSocket by replying 101 with\r
// Sec-WebSocket-Accept = base64( SHA-1( key + magic GUID ) ) — a fixed challenge that\r
// stops a confused HTTP cache/server from being tricked into the handshake. After that,\r
// messages travel as small frames (FIN, opcode, mask, length). Client→server frames are\r
// XOR-masked. The accept value is verified against the RFC 6455 §1.3 vector.\r
import { sha1 } from './sha1';\r
\r
export const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';\r
\r
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';\r
export function base64(bytes: Uint8Array): string {\r
  let out = '';\r
  for (let i = 0; i < bytes.length; i += 3) {\r
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];\r
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);\r
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];\r
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';\r
    out += i + 2 < bytes.length ? B64[n & 63] : '=';\r
  }\r
  return out;\r
}\r
\r
/** Sec-WebSocket-Accept = base64(SHA1(Sec-WebSocket-Key + GUID)). */\r
export function accept(key: string): string {\r
  return base64(sha1(new TextEncoder().encode(key + WS_GUID)));\r
}\r
\r
export const OPCODES: Record<number, string> = { 0x0: 'continuation', 0x1: 'text', 0x2: 'binary', 0x8: 'close', 0x9: 'ping', 0xa: 'pong' };\r
\r
/** XOR each payload byte with the 4-byte masking key (client→server frames). */\r
export function maskPayload(data: Uint8Array, key: Uint8Array): Uint8Array {\r
  const out = new Uint8Array(data.length);\r
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % 4];\r
  return out;\r
}\r
\r
export interface Frame { fin: boolean; opcode: number; masked: boolean; len: number; bytes: Uint8Array }\r
\r
/** Build a single WebSocket frame (payloads < 126 bytes for the demo). */\r
export function buildFrame(opcode: number, payload: Uint8Array, maskKey?: Uint8Array): Frame {\r
  const masked = !!maskKey;\r
  const header: number[] = [0x80 | (opcode & 0x0f)]; // FIN=1\r
  header.push((masked ? 0x80 : 0) | (payload.length & 0x7f));\r
  const body = masked ? maskPayload(payload, maskKey!) : payload;\r
  const bytes = Uint8Array.from([...header, ...(masked ? [...maskKey!] : []), ...body]);\r
  return { fin: true, opcode, masked, len: payload.length, bytes };\r
}\r
`;export{e as default};