var e=`// 802.1Q VLAN tagging — the 4-byte tag a switch inserts into an Ethernet frame to\r
// keep virtual LANs separate on one wire. The tag sits right after the source MAC:\r
// a 2-byte TPID (0x8100, marking the frame tagged) then a 2-byte TCI = PCP(3) priority\r
// ‖ DEI(1) drop-eligible ‖ VID(12) the VLAN id. Access ports carry one untagged VLAN;\r
// trunk ports carry many, tagged, with one untagged "native" VLAN — and that native\r
// VLAN is exactly what the double-tagging hop abuses. Real bytes (IEEE 802.1Q).\r
\r
export const TPID = 0x8100;\r
\r
export interface Tag { pcp: number; dei: number; vid: number }\r
\r
/** Tag Control Information: PCP<<13 | DEI<<12 | VID. */\r
export const tci = (t: Tag): number => ((t.pcp & 0x7) << 13) | ((t.dei & 0x1) << 12) | (t.vid & 0xfff);\r
\r
/** The 4 on-wire tag bytes: TPID (2) + TCI (2), big-endian. */\r
export function buildTag(t: Tag): Uint8Array {\r
  const c = tci(t);\r
  return Uint8Array.from([(TPID >> 8) & 0xff, TPID & 0xff, (c >> 8) & 0xff, c & 0xff]);\r
}\r
\r
export interface ParsedTag { tpid: number; pcp: number; dei: number; vid: number }\r
\r
export function parseTag(b: Uint8Array): ParsedTag {\r
  const tpid = (b[0] << 8) | b[1];\r
  const c = (b[2] << 8) | b[3];\r
  return { tpid, pcp: (c >> 13) & 0x7, dei: (c >> 12) & 0x1, vid: c & 0xfff };\r
}\r
\r
/** What the first switch does to a frame arriving on its native (untagged) VLAN:\r
 *  it removes the outer tag. With a double-tagged frame, the inner tag survives onto\r
 *  the trunk and a second switch delivers it to that VLAN — the VLAN-hopping attack. */\r
export function stripOuter(tags: Tag[]): Tag[] {\r
  return tags.slice(1);\r
}\r
\r
export const VID_MIN = 0, VID_MAX = 4095;\r
`;export{e as default};