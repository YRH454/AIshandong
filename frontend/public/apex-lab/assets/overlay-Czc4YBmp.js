var e=`// VXLAN overlay networking (RFC 7348) — how a cloud runs thousands of isolated tenant L2 networks\r
// over one shared L3 fabric. A VTEP (VXLAN Tunnel Endpoint, usually the hypervisor vSwitch) takes a\r
// tenant's inner Ethernet frame and wraps it: VXLAN header (carrying a 24-bit VNI that names the\r
// tenant network) → UDP (dst port 4789) → outer IP (this VTEP → the remote VTEP) → outer Ethernet.\r
// The underlay just routes a normal UDP/IP packet; the remote VTEP strips the wrappers and delivers\r
// the original frame. 24 bits of VNI means ~16 million tenant networks on the same wire, fully\r
// isolated. The VTEP also LEARNS: it maps (VNI, inner source MAC) → the remote VTEP IP it arrived\r
// from, so replies are unicast across the fabric instead of flooded. Pure encapsulation model, tested.\r
\r
export interface Frame { dstMac: string; srcMac: string; payload: string }\r
\r
export interface VxlanPacket {\r
  outerEth: { note: string };\r
  outerIp: { src: string; dst: string; proto: string };\r
  udp: { srcPort: number; dstPort: number };\r
  vxlan: { flagsHex: string; vni: number };\r
  inner: Frame;\r
  overheadBytes: number;\r
}\r
\r
export const VXLAN_PORT = 4789; // RFC 7348 §5: IANA-assigned destination UDP port\r
export const VXLAN_OVERHEAD = 50; // outer Eth(14) + IP(20) + UDP(8) + VXLAN(8)\r
\r
/** A simple deterministic hash → ephemeral source port (real VTEPs hash the inner flow for ECMP entropy). */\r
function flowPort(inner: Frame): number {\r
  let h = 0;\r
  for (const ch of inner.srcMac + inner.dstMac + inner.payload) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;\r
  return 49152 + (h % 16384); // 49152–65535 ephemeral range\r
}\r
\r
/** Wrap a tenant frame for VNI \`vni\`, tunneled from srcVtep to dstVtep. */\r
export function encapsulate(inner: Frame, vni: number, srcVtep: string, dstVtep: string): VxlanPacket {\r
  return {\r
    outerEth: { note: 'next-hop MACs in the underlay (rewritten each hop)' },\r
    outerIp: { src: srcVtep, dst: dstVtep, proto: 'UDP (17)' },\r
    udp: { srcPort: flowPort(inner), dstPort: VXLAN_PORT },\r
    vxlan: { flagsHex: '0x08', vni }, // the I flag (0x08) marks the VNI as valid\r
    inner,\r
    overheadBytes: VXLAN_OVERHEAD,\r
  };\r
}\r
\r
// ---- VTEP MAC learning (the control-plane half) -------------------------------------------------\r
\r
export type MacTable = Record<string, string>; // key \`\${vni}|\${mac}\` → remote VTEP IP\r
const key = (vni: number, mac: string) => \`\${vni}|\${mac}\`;\r
\r
/** Learn that \`mac\` in tenant network \`vni\` lives behind the VTEP at \`vtepIp\`. */\r
export function learn(table: MacTable, vni: number, mac: string, vtepIp: string): MacTable {\r
  return { ...table, [key(vni, mac)]: vtepIp };\r
}\r
\r
/** Find the VTEP to unicast to, or null if unknown (→ flood as BUM traffic to all VTEPs in the VNI). */\r
export function lookup(table: MacTable, vni: number, mac: string): string | null {\r
  return table[key(vni, mac)] ?? null;\r
}\r
`;export{e as default};