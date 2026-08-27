var e=`// A learning Ethernet switch — how a switch forwards frames without any config.\r
// It keeps a CAM (content-addressable memory) table of MAC → port. For each frame\r
// it does two things (IEEE 802.1D §7.8):\r
//   1. LEARN: record that the SOURCE MAC lives on the ingress port (refreshing age).\r
//   2. FORWARD: if the DESTINATION MAC is a known unicast on a *different* port,\r
//      send only out that port; if it's the same port, drop it (already delivered);\r
//      if it's unknown or broadcast, FLOOD out every port except the ingress.\r
// This is why the first packet to a new host floods, and later ones don't. Tested.\r
\r
export const BROADCAST = 'ff:ff:ff:ff:ff:ff';\r
\r
export interface CamEntry { mac: string; port: number; age: number }\r
export type Action = 'flood-unknown' | 'flood-broadcast' | 'forward' | 'filter';\r
\r
export interface SwitchResult {\r
  learned: boolean; // did this frame add/move a CAM entry?\r
  action: Action;\r
  egress: number[]; // ports the frame is sent out of\r
  reason: string;\r
}\r
\r
export class Switch {\r
  readonly ports: number;\r
  private cam: Map<string, CamEntry> = new Map();\r
  private clock = 0;\r
\r
  constructor(ports: number) { this.ports = ports; }\r
\r
  get table(): CamEntry[] {\r
    return [...this.cam.values()].sort((a, b) => a.port - b.port);\r
  }\r
\r
  lookup(mac: string): number | null {\r
    return this.cam.get(mac)?.port ?? null;\r
  }\r
\r
  /** Process a frame {src,dst,inPort}: learn the source, then decide forwarding. */\r
  frame(src: string, dst: string, inPort: number): SwitchResult {\r
    this.clock++;\r
    // 1. LEARN the source MAC on the ingress port (new entry, or moved/refreshed)\r
    const prev = this.cam.get(src);\r
    const learned = !prev || prev.port !== inPort;\r
    this.cam.set(src, { mac: src, port: inPort, age: this.clock });\r
\r
    // 2. FORWARD based on the destination\r
    const others = this.allPortsExcept(inPort);\r
    if (dst === BROADCAST) {\r
      return { learned, action: 'flood-broadcast', egress: others, reason: 'Broadcast destination → flood out every other port.' };\r
    }\r
    const dstPort = this.cam.get(dst)?.port ?? null;\r
    if (dstPort === null) {\r
      return { learned, action: 'flood-unknown', egress: others, reason: \`\${dst} is not in the CAM table yet → flood (unknown-unicast) and learn from the reply.\` };\r
    }\r
    if (dstPort === inPort) {\r
      return { learned, action: 'filter', egress: [], reason: \`\${dst} is on the SAME port the frame arrived on → drop it (already delivered on that segment).\` };\r
    }\r
    return { learned, action: 'forward', egress: [dstPort], reason: \`\${dst} is known on port \${dstPort} → forward only there (no flooding).\` };\r
  }\r
\r
  /** Remove CAM entries older than \`maxAge\` ticks (aging). */\r
  age(maxAge: number): void {\r
    for (const [mac, e] of this.cam) if (this.clock - e.age >= maxAge) this.cam.delete(mac);\r
  }\r
\r
  private allPortsExcept(p: number): number[] {\r
    const out: number[] = [];\r
    for (let i = 1; i <= this.ports; i++) if (i !== p) out.push(i);\r
    return out;\r
  }\r
}\r
`;export{e as default};