var e=`// WireGuard's cryptokey routing. A WireGuard peer is a Curve25519 public key plus a list of AllowedIPs, and that one\r
// list does two jobs at once: OUTBOUND it is the route (a destination IP is sent, encrypted, to whichever peer's\r
// AllowedIPs covers it — longest prefix wins), and INBOUND it is the ACL (a packet decrypted with a peer's key is only\r
// accepted if its source IP is inside that peer's AllowedIPs, so a peer can't spoof addresses that belong to another).\r
// One list, cryptographically bound to a key, replaces the routing table and firewall of a traditional VPN. The\r
// handshake and ciphers (Noise IK over Curve25519, ChaCha20-Poly1305) are real WireGuard but out of scope here; this\r
// models the routing/ACL decision, which is the part that trips people up.\r
\r
export interface Peer { name: string; pubkey: string; allowedIps: string[] }\r
\r
const ipToInt = (ip: string): number =>\r
  ip.split('.').reduce((acc, oct) => (acc * 256 + (parseInt(oct, 10) & 0xff)) >>> 0, 0) >>> 0;\r
\r
// Does \`ip\` fall inside CIDR \`base/len\`?  len 0 matches everything (a full-tunnel 0.0.0.0/0 peer).\r
export function inCidr(ip: string, cidr: string): boolean {\r
  const [base, lenStr] = cidr.split('/');\r
  const len = parseInt(lenStr, 10);\r
  const mask = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0;\r
  return ((ipToInt(ip) & mask) >>> 0) === ((ipToInt(base) & mask) >>> 0);\r
}\r
\r
const prefixLen = (cidr: string): number => parseInt(cidr.split('/')[1], 10);\r
\r
export interface Route { peer: Peer; cidr: string }\r
\r
// Outbound: pick the peer whose AllowedIPs contains the destination by the LONGEST (most specific) prefix. null = no\r
// peer covers it, so WireGuard drops the packet (unlike a default route, there is nowhere to send it).\r
export function routeOutbound(peers: Peer[], destIp: string): Route | null {\r
  let best: Route | null = null;\r
  for (const peer of peers) {\r
    for (const cidr of peer.allowedIps) {\r
      if (inCidr(destIp, cidr) && (best === null || prefixLen(cidr) > prefixLen(best.cidr))) {\r
        best = { peer, cidr };\r
      }\r
    }\r
  }\r
  return best;\r
}\r
\r
// Inbound: a packet arrived decrypted under \`peer\`'s key, claiming source \`srcIp\`. Accept only if that source is inside\r
// the same peer's AllowedIPs — otherwise it's a spoof (a source that peer has no right to send) and is dropped.\r
export function acceptInbound(peer: Peer, srcIp: string): boolean {\r
  return peer.allowedIps.some((cidr) => inCidr(srcIp, cidr));\r
}\r
\r
export const DEFAULT_PEERS = (): Peer[] => [\r
  { name: 'laptop', pubkey: 'HIgo…3n8=', allowedIps: ['10.0.0.2/32'] },\r
  { name: 'office-gw', pubkey: 'xTIB…9pk=', allowedIps: ['10.0.0.3/32', '192.168.1.0/24'] },\r
];\r
`;export{e as default};