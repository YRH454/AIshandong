var e=`// Minimal classic libpcap (.pcap) reader. Parses the 24-byte global header and\r
// each 16-byte record header + packet data, handling both byte orders and the\r
// µs/ns timestamp variants. Pure and testable; pcapng (block-based) is not\r
// supported. Maps the link-layer type to the protocol id to start dissection at.\r
export interface PcapPacket {\r
  index: number;\r
  tsSec: number;\r
  tsUsec: number;\r
  origLen: number; // length on the wire (may exceed captured bytes if snapped)\r
  bytes: number[]; // the captured link-layer frame\r
}\r
\r
export interface Pcap {\r
  linkType: number;\r
  startId: string; // protocol id to dissect each packet from\r
  packets: PcapPacket[];\r
}\r
\r
const LINKTYPE_START: Record<number, string> = {\r
  1: 'ethernet', // LINKTYPE_ETHERNET\r
  101: 'ipv4', // LINKTYPE_RAW (commonly raw IPv4)\r
};\r
\r
const MAX_PACKETS = 20000;\r
\r
export function parsePcap(buf: ArrayBuffer): Pcap {\r
  if (buf.byteLength < 24) throw new Error('Too small to be a .pcap file.');\r
  const dv = new DataView(buf);\r
  const magic = dv.getUint32(0, false);\r
\r
  let le: boolean;\r
  if (magic === 0xa1b2c3d4 || magic === 0xa1b23c4d) le = false; // big-endian (µs / ns)\r
  else if (magic === 0xd4c3b2a1 || magic === 0x4d3cb2a1) le = true; // little-endian (µs / ns)\r
  else throw new Error('Not a classic .pcap file (bad magic number). pcapng is not supported yet.');\r
\r
  const linkType = dv.getUint32(20, le);\r
  const startId = LINKTYPE_START[linkType] ?? 'ethernet';\r
\r
  const packets: PcapPacket[] = [];\r
  let off = 24;\r
  while (off + 16 <= buf.byteLength && packets.length < MAX_PACKETS) {\r
    const tsSec = dv.getUint32(off, le);\r
    const tsUsec = dv.getUint32(off + 4, le);\r
    const inclLen = dv.getUint32(off + 8, le);\r
    const origLen = dv.getUint32(off + 12, le);\r
    off += 16;\r
    if (inclLen === 0 || off + inclLen > buf.byteLength) break; // truncated / malformed\r
    const bytes: number[] = new Array(inclLen);\r
    for (let i = 0; i < inclLen; i++) bytes[i] = dv.getUint8(off + i);\r
    off += inclLen;\r
    packets.push({ index: packets.length, tsSec, tsUsec, origLen, bytes });\r
  }\r
  if (packets.length === 0) throw new Error('No packets found in the file.');\r
  return { linkType, startId, packets };\r
}\r
\r
const readBytes = (dv: DataView, off: number, n: number): number[] => {\r
  const out: number[] = new Array(n);\r
  for (let i = 0; i < n; i++) out[i] = dv.getUint8(off + i);\r
  return out;\r
};\r
\r
const PCAPNG_MAGIC = 0x0a0d0d0a; // Section Header Block type\r
const BYTE_ORDER_MAGIC = 0x1a2b3c4d;\r
\r
/** Minimal pcapng (block-based) reader: Section Header, Interface Description, and (Enhanced/Simple) Packet blocks. */\r
export function parsePcapng(buf: ArrayBuffer): Pcap {\r
  if (buf.byteLength < 28) throw new Error('Too small to be a pcapng file.');\r
  const dv = new DataView(buf);\r
  if (dv.getUint32(0, false) !== PCAPNG_MAGIC) throw new Error('Not a pcapng file.');\r
  // The byte-order magic in the Section Header Block (offset 8) tells us the endianness.\r
  const le = dv.getUint32(8, false) !== BYTE_ORDER_MAGIC;\r
  if (dv.getUint32(8, le) !== BYTE_ORDER_MAGIC) throw new Error('pcapng byte-order magic not found.');\r
\r
  const linkTypes: number[] = []; // one per Interface Description Block\r
  const packets: PcapPacket[] = [];\r
  let off = 0;\r
  while (off + 12 <= buf.byteLength && packets.length < MAX_PACKETS) {\r
    const type = dv.getUint32(off, le);\r
    const blockLen = dv.getUint32(off + 4, le);\r
    if (blockLen < 12 || blockLen % 4 !== 0 || off + blockLen > buf.byteLength) break;\r
\r
    if (type === 0x00000001) {\r
      // Interface Description Block: LinkType (2), Reserved (2), SnapLen (4)\r
      linkTypes.push(dv.getUint16(off + 8, le));\r
    } else if (type === 0x00000006) {\r
      // Enhanced Packet Block: iface (4), ts_hi (4), ts_lo (4), cap_len (4), orig_len (4), data…\r
      const capLen = dv.getUint32(off + 20, le);\r
      const origLen = dv.getUint32(off + 24, le);\r
      const tsHi = dv.getUint32(off + 12, le);\r
      const tsLo = dv.getUint32(off + 16, le);\r
      if (28 + capLen <= blockLen) {\r
        const ts = tsHi * 2 ** 32 + tsLo; // default µs resolution\r
        packets.push({ index: packets.length, tsSec: Math.floor(ts / 1e6), tsUsec: ts % 1e6, origLen, bytes: readBytes(dv, off + 28, capLen) });\r
      }\r
    } else if (type === 0x00000003) {\r
      // Simple Packet Block: orig_len (4), data… (captured length implied by the block length)\r
      const origLen = dv.getUint32(off + 8, le);\r
      const capLen = blockLen - 16;\r
      if (capLen > 0) packets.push({ index: packets.length, tsSec: 0, tsUsec: 0, origLen, bytes: readBytes(dv, off + 12, capLen) });\r
    }\r
    off += blockLen;\r
  }\r
  if (packets.length === 0) throw new Error('No packets found in the pcapng file.');\r
  const linkType = linkTypes[0] ?? 1;\r
  return { linkType, startId: LINKTYPE_START[linkType] ?? 'ethernet', packets };\r
}\r
\r
/** Detect classic .pcap vs .pcapng by magic and parse accordingly. */\r
export function parseCapture(buf: ArrayBuffer): Pcap {\r
  if (buf.byteLength >= 4 && new DataView(buf).getUint32(0, false) === PCAPNG_MAGIC) return parsePcapng(buf);\r
  return parsePcap(buf);\r
}\r
`;export{e as default};