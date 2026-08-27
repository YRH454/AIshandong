var e=`// Turn the builder form into a real Connection. Pure and testable. Only fields\r
// that actually thread through to bytes are exposed — IPs, ports, TTL, window,\r
// and the TCP flags — so every control provably changes the frame.\r
import { DEFAULT_CONNECTION } from '../core/builder';\r
import type { Connection } from '../core/types';\r
\r
export interface FlagSet { SYN: boolean; ACK: boolean; PSH: boolean; RST: boolean; FIN: boolean }\r
\r
export interface ConnForm {\r
  srcIp: string;\r
  dstIp: string;\r
  srcPort: string;\r
  dstPort: string;\r
  ttl: string;\r
  window: string;\r
  flags: FlagSet;\r
}\r
\r
export const DEFAULT_FORM: ConnForm = {\r
  srcIp: DEFAULT_CONNECTION.srcIp.join('.'),\r
  dstIp: DEFAULT_CONNECTION.dstIp.join('.'),\r
  srcPort: String(DEFAULT_CONNECTION.srcPort),\r
  dstPort: String(DEFAULT_CONNECTION.dstPort),\r
  ttl: String(DEFAULT_CONNECTION.ttl),\r
  window: String(DEFAULT_CONNECTION.window),\r
  // DEFAULT_CONNECTION.flags = 0x18 = PSH + ACK\r
  flags: { SYN: false, ACK: true, PSH: true, RST: false, FIN: false },\r
};\r
\r
function parseIp(s: string): number[] | null {\r
  const parts = s.trim().split('.');\r
  if (parts.length !== 4) return null;\r
  const out: number[] = [];\r
  for (const p of parts) {\r
    if (!/^\\d{1,3}$/.test(p)) return null;\r
    const n = Number(p);\r
    if (n > 255) return null;\r
    out.push(n);\r
  }\r
  return out;\r
}\r
\r
function parseRange(s: string, min: number, max: number): number | null {\r
  if (!/^\\d+$/.test(s.trim())) return null;\r
  const n = Number(s.trim());\r
  return n >= min && n <= max ? n : null;\r
}\r
\r
/** TCP flags byte: bit layout CWR ECE URG ACK PSH RST SYN FIN (MSB→LSB). */\r
export function flagsByte(f: FlagSet): number {\r
  return (f.ACK ? 0x10 : 0) | (f.PSH ? 0x08 : 0) | (f.RST ? 0x04 : 0) | (f.SYN ? 0x02 : 0) | (f.FIN ? 0x01 : 0);\r
}\r
\r
/** Build a Connection from the form, falling back to defaults per invalid field. */\r
export function buildConnection(form: ConnForm): { conn: Connection; errors: Partial<Record<keyof ConnForm, string>> } {\r
  const errors: Partial<Record<keyof ConnForm, string>> = {};\r
\r
  const srcIp = parseIp(form.srcIp);\r
  if (!srcIp) errors.srcIp = 'IPv4 a.b.c.d';\r
  const dstIp = parseIp(form.dstIp);\r
  if (!dstIp) errors.dstIp = 'IPv4 a.b.c.d';\r
  const srcPort = parseRange(form.srcPort, 0, 65535);\r
  if (srcPort == null) errors.srcPort = '0–65535';\r
  const dstPort = parseRange(form.dstPort, 0, 65535);\r
  if (dstPort == null) errors.dstPort = '0–65535';\r
  const ttl = parseRange(form.ttl, 1, 255);\r
  if (ttl == null) errors.ttl = '1–255';\r
  const window = parseRange(form.window, 0, 65535);\r
  if (window == null) errors.window = '0–65535';\r
\r
  const conn: Connection = {\r
    ...DEFAULT_CONNECTION,\r
    srcIp: srcIp ?? DEFAULT_CONNECTION.srcIp,\r
    dstIp: dstIp ?? DEFAULT_CONNECTION.dstIp,\r
    srcPort: srcPort ?? DEFAULT_CONNECTION.srcPort,\r
    dstPort: dstPort ?? DEFAULT_CONNECTION.dstPort,\r
    ttl: ttl ?? DEFAULT_CONNECTION.ttl,\r
    window: window ?? DEFAULT_CONNECTION.window,\r
    flags: flagsByte(form.flags),\r
  };\r
  return { conn, errors };\r
}\r
`;export{e as default};