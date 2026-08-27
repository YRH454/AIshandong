var e=`// Packet-filter firewall (iptables/netfilter), modelled honestly. A chain is an ORDERED list of rules; each packet\r
// walks it top to bottom and the FIRST rule that matches decides its fate (ACCEPT / DROP / REJECT). If no rule\r
// matches, the chain's default POLICY applies. That "first match wins" is the whole game: a broad ACCEPT placed above\r
// a specific DROP silently lets the bad traffic through, and the secure baseline is a default-DROP policy with\r
// explicit allows above it. Matching is real CIDR arithmetic (reuses subnet.ts).\r
import { parseIp, maskOf } from './subnet';\r
\r
export type Action = 'ACCEPT' | 'DROP' | 'REJECT';\r
export type Proto = 'tcp' | 'udp';\r
export type Policy = 'ACCEPT' | 'DROP';\r
export type Rule = { proto: Proto | 'any'; src: string; dport: number | 'any'; action: Action; enabled?: boolean };\r
export type Packet = { proto: Proto; src: string; dport: number };\r
\r
// Is \`ip\` inside \`cidr\`? Accepts 'any' / 0.0.0.0/0 (match all), an "a.b.c.d/n" block, or a bare address (= /32).\r
export function ipInCidr(ip: string, cidr: string): boolean {\r
  if (cidr === 'any' || cidr === '0.0.0.0/0') return true;\r
  const ipv = parseIp(ip);\r
  if (ipv === null) return false;\r
  const m = cidr.match(/^(\\d+\\.\\d+\\.\\d+\\.\\d+)\\/(\\d+)$/);\r
  if (!m) {\r
    const bare = parseIp(cidr);\r
    return bare !== null && bare === ipv; // a bare IP is an exact (/32) match\r
  }\r
  const net = parseIp(m[1]);\r
  const pfx = Number(m[2]);\r
  if (net === null || pfx < 0 || pfx > 32) return false;\r
  const mask = maskOf(pfx);\r
  return ((ipv & mask) >>> 0) === ((net & mask) >>> 0);\r
}\r
\r
// Does a rule match a packet? A disabled rule never matches; 'any' is a wildcard for proto and port.\r
export function matchRule(rule: Rule, pkt: Packet): boolean {\r
  if (rule.enabled === false) return false;\r
  if (rule.proto !== 'any' && rule.proto !== pkt.proto) return false;\r
  if (rule.dport !== 'any' && rule.dport !== pkt.dport) return false;\r
  return ipInCidr(pkt.src, rule.src);\r
}\r
\r
// Walk the chain top-down: the first matching rule decides; otherwise the default policy. Returns the verdict and the\r
// index of the deciding rule (-1 when the policy decided).\r
export function evaluate(rules: Rule[], pkt: Packet, policy: Policy): { action: Action; matchedIndex: number } {\r
  for (let i = 0; i < rules.length; i++) {\r
    if (matchRule(rules[i], pkt)) return { action: rules[i].action, matchedIndex: i };\r
  }\r
  return { action: policy, matchedIndex: -1 };\r
}\r
`;export{e as default};