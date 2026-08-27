var e=`// TTL decrement and the IPv4 header-checksum recompute — the core job every router does\r
// to every packet. The Time To Live field (RFC 791) is decremented by one at each hop;\r
// because it lives in the header, the 16-bit header checksum (RFC 1071) must be\r
// recomputed every hop too. When TTL reaches 0 the packet is dropped and the router\r
// returns ICMP Time Exceeded (Type 11) — which is exactly what traceroute exploits. Real\r
// checksum from the engine core (inetChecksum), anchored to the canonical 0xb861 header.\r
import { inetChecksum } from '../core/checksum';\r
\r
// Canonical IPv4 header (Wikipedia / RFC worked example): 192.168.0.1 → 192.168.0.199,\r
// UDP, total length 0x73, TTL 0x40 — checksum field zeroed here so we compute it.\r
const BASE: number[] = [\r
  0x45, 0x00, 0x00, 0x73, 0x00, 0x00, 0x40, 0x00,\r
  0x40, 0x11, 0x00, 0x00, 0xc0, 0xa8, 0x00, 0x01,\r
  0xc0, 0xa8, 0x00, 0xc7,\r
];\r
const TTL_OFFSET = 8;\r
\r
/** The 20-byte header with a given TTL and the checksum field zeroed (ready to checksum). */\r
export function headerAtTtl(ttl: number): number[] {\r
  const h = BASE.slice();\r
  h[TTL_OFFSET] = ttl & 0xff;\r
  h[10] = 0; h[11] = 0;\r
  return h;\r
}\r
\r
/** The correct IPv4 header checksum for a given TTL. */\r
export const checksumFor = (ttl: number): number => inetChecksum(headerAtTtl(ttl));\r
\r
export interface Hop { hop: number; ttlIn: number; ttlOut: number; checksum: number; delivered: boolean; expired: boolean }\r
export interface Journey { hops: Hop[]; expired: boolean; deliveredAtHop: number | null }\r
\r
/** Walk a packet across \`routerCount\` routers starting from \`startTtl\`. */\r
export function walk(startTtl: number, routerCount: number): Journey {\r
  const hops: Hop[] = [];\r
  let ttl = startTtl;\r
  for (let i = 0; i < routerCount; i++) {\r
    const ttlIn = ttl;\r
    ttl = ttl - 1; // each router decrements TTL by one\r
    const expired = ttl <= 0;\r
    const checksum = checksumFor(ttl < 0 ? 0 : ttl);\r
    const delivered = !expired && i === routerCount - 1;\r
    hops.push({ hop: i + 1, ttlIn, ttlOut: Math.max(0, ttl), checksum, delivered, expired });\r
    if (expired) return { hops, expired: true, deliveredAtHop: null };\r
  }\r
  return { hops, expired: false, deliveredAtHop: routerCount };\r
}\r
`;export{e as default};