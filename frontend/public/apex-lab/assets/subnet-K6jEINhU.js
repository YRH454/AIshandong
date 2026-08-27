var e=`// IPv4 subnet math — the real bit arithmetic behind CIDR. A prefix length /n\r
// splits a 32-bit address into a network part (the high n bits, fixed) and a host\r
// part (the low 32-n bits, which vary). Everything here is exact integer math on\r
// the 32-bit address, tested against known examples. RFC 4632 (CIDR).\r
\r
const M32 = 0xffffffff;\r
\r
/** Parse "a.b.c.d" → unsigned 32-bit integer, or null if malformed. */\r
export function parseIp(s: string): number | null {\r
  const parts = s.trim().split('.');\r
  if (parts.length !== 4) return null;\r
  let v = 0;\r
  for (const p of parts) {\r
    if (!/^\\d{1,3}$/.test(p)) return null;\r
    const n = Number(p);\r
    if (n > 255) return null;\r
    v = (v * 256 + n) >>> 0;\r
  }\r
  return v >>> 0;\r
}\r
\r
/** Format a 32-bit integer as dotted-quad. */\r
export function formatIp(v: number): string {\r
  return [24, 16, 8, 0].map((sh) => (v >>> sh) & 0xff).join('.');\r
}\r
\r
/** The /n netmask as a 32-bit integer (n=0 → 0.0.0.0, n=32 → 255.255.255.255). */\r
export function maskOf(prefix: number): number {\r
  return prefix === 0 ? 0 : (M32 << (32 - prefix)) >>> 0;\r
}\r
\r
export interface Subnet {\r
  ok: boolean;\r
  error?: string;\r
  prefix: number;\r
  mask: string;\r
  wildcard: string;\r
  network: string;\r
  broadcast: string;\r
  firstHost: string;\r
  lastHost: string;\r
  totalAddresses: number;\r
  usableHosts: number;\r
  networkInt: number; // for ordering / visualization\r
  broadcastInt: number;\r
}\r
\r
/** Compute the full description of a CIDR block "a.b.c.d/n". */\r
export function subnet(cidr: string): Subnet {\r
  const bad = (error: string): Subnet => ({\r
    ok: false, error, prefix: 0, mask: '', wildcard: '', network: '', broadcast: '',\r
    firstHost: '', lastHost: '', totalAddresses: 0, usableHosts: 0, networkInt: 0, broadcastInt: 0,\r
  });\r
  const m = cidr.trim().match(/^(\\d+\\.\\d+\\.\\d+\\.\\d+)\\s*\\/\\s*(\\d+)$/);\r
  if (!m) return bad('Use a.b.c.d/n, e.g. 192.168.1.0/24');\r
  const ip = parseIp(m[1]);\r
  const prefix = Number(m[2]);\r
  if (ip === null) return bad('That is not a valid IPv4 address.');\r
  if (prefix < 0 || prefix > 32) return bad('Prefix length must be 0–32.');\r
\r
  const mask = maskOf(prefix);\r
  const network = (ip & mask) >>> 0;\r
  const broadcast = (network | (~mask & M32)) >>> 0;\r
  const total = 2 ** (32 - prefix);\r
  // /31 (point-to-point, RFC 3021) and /32 (host) have no separate net/broadcast hosts\r
  const usable = prefix >= 31 ? total : total - 2;\r
  const firstHost = prefix >= 31 ? network : (network + 1) >>> 0;\r
  const lastHost = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;\r
\r
  return {\r
    ok: true, prefix,\r
    mask: formatIp(mask),\r
    wildcard: formatIp(~mask & M32),\r
    network: formatIp(network),\r
    broadcast: formatIp(broadcast),\r
    firstHost: formatIp(firstHost),\r
    lastHost: formatIp(lastHost),\r
    totalAddresses: total,\r
    usableHosts: usable,\r
    networkInt: network,\r
    broadcastInt: broadcast,\r
  };\r
}\r
\r
export interface SubnetBlock { network: string; broadcast: string; prefix: number; networkInt: number; usableHosts: number }\r
\r
/**\r
 * Split a CIDR block into 2^(newPrefix-prefix) equal child subnets at newPrefix.\r
 * Returns null if newPrefix isn't larger than the block's prefix (or > 32).\r
 */\r
export function splitInto(cidr: string, newPrefix: number): SubnetBlock[] | null {\r
  const base = subnet(cidr);\r
  if (!base.ok || newPrefix <= base.prefix || newPrefix > 32) return null;\r
  const childSize = 2 ** (32 - newPrefix);\r
  const count = 2 ** (newPrefix - base.prefix);\r
  if (count > 1024) return null; // keep the visualization sane\r
  const blocks: SubnetBlock[] = [];\r
  for (let i = 0; i < count; i++) {\r
    const net = (base.networkInt + i * childSize) >>> 0;\r
    const bc = (net + childSize - 1) >>> 0;\r
    blocks.push({\r
      network: formatIp(net), broadcast: formatIp(bc), prefix: newPrefix, networkInt: net,\r
      usableHosts: newPrefix >= 31 ? childSize : childSize - 2,\r
    });\r
  }\r
  return blocks;\r
}\r
`;export{e as default};