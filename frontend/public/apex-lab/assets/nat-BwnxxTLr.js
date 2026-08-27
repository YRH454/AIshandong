var e=`// NAT / PAT (port address translation) — how a whole home or office shares ONE\r
// public IP. The NAT box keeps a translation table: each outbound flow gets a\r
// unique public source port, so a reply addressed to (publicIP:port) can be demuxed\r
// back to the exact internal host:port that started it. Unsolicited inbound packets\r
// have no table entry, so they're dropped — that's the "firewall for free" effect.\r
// Pure, deterministic model (RFC 3022 / RFC 2663). Tested.\r
\r
export interface Endpoint { ip: string; port: number }\r
export interface Mapping {\r
  innerIp: string;\r
  innerPort: number;\r
  publicPort: number; // the port NAT assigned on its single public IP\r
  dstIp: string;\r
  dstPort: number;\r
}\r
\r
export interface OutboundResult {\r
  rewritten: Endpoint; // the new source the packet carries on the public side\r
  mapping: Mapping;\r
  created: boolean; // true if a new table entry was added (vs reused)\r
}\r
\r
export interface InboundResult {\r
  delivered: boolean;\r
  to?: Endpoint; // the internal host:port it was demuxed to\r
  reason: string;\r
}\r
\r
export class Nat {\r
  readonly publicIp: string;\r
  private table: Mapping[] = [];\r
  private nextPort: number;\r
\r
  constructor(publicIp: string, firstPort = 50000) {\r
    this.publicIp = publicIp;\r
    this.nextPort = firstPort;\r
  }\r
\r
  get mappings(): Mapping[] {\r
    return this.table.slice();\r
  }\r
\r
  /** Translate an outbound packet, creating or reusing a mapping (PAT overload). */\r
  outbound(src: Endpoint, dst: Endpoint): OutboundResult {\r
    // reuse the existing mapping for this exact flow (same inner + same destination)\r
    const existing = this.table.find(\r
      (m) => m.innerIp === src.ip && m.innerPort === src.port && m.dstIp === dst.ip && m.dstPort === dst.port,\r
    );\r
    if (existing) {\r
      return { rewritten: { ip: this.publicIp, port: existing.publicPort }, mapping: existing, created: false };\r
    }\r
    const publicPort = this.allocatePort();\r
    const mapping: Mapping = { innerIp: src.ip, innerPort: src.port, publicPort, dstIp: dst.ip, dstPort: dst.port };\r
    this.table.push(mapping);\r
    return { rewritten: { ip: this.publicIp, port: publicPort }, mapping, created: true };\r
  }\r
\r
  /** Demux a return packet (to publicIP:publicPort, from the original destination). */\r
  inbound(toPublicPort: number, from: Endpoint): InboundResult {\r
    const m = this.table.find((x) => x.publicPort === toPublicPort && x.dstIp === from.ip && x.dstPort === from.port);\r
    if (!m) {\r
      return { delivered: false, reason: \`No table entry for \${this.publicIp}:\${toPublicPort} from \${from.ip}:\${from.port} — unsolicited, so it is dropped.\` };\r
    }\r
    return { delivered: true, to: { ip: m.innerIp, port: m.innerPort }, reason: \`Matched the table: delivered to \${m.innerIp}:\${m.innerPort}.\` };\r
  }\r
\r
  private allocatePort(): number {\r
    // keep allocating fresh ports; never collide with a live mapping\r
    while (this.table.some((m) => m.publicPort === this.nextPort)) this.nextPort++;\r
    return this.nextPort++;\r
  }\r
}\r
`;export{e as default};