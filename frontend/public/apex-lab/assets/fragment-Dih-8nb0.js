var e=`// IPv4 fragmentation & MTU (RFC 791) — what happens when a datagram is bigger than\r
// a link will carry. The MTU caps the whole IP packet (header + payload); the\r
// router splits the payload into fragments that each fit, copying the header onto\r
// each. Every fragment but the last has its payload size as a multiple of 8 bytes,\r
// carries a Fragment Offset measured in 8-byte units, and sets the More-Fragments\r
// (MF) flag; the last fragment clears MF. Reassembly stitches them back by offset.\r
// If the Don't-Fragment (DF) flag is set, a too-big packet is dropped and the router\r
// returns ICMP "fragmentation needed" with the next-hop MTU — that's Path-MTU\r
// Discovery, which shrinks the sender instead of fragmenting. Pure, tested.\r
\r
export const IP_HEADER = 20; // bytes (no options)\r
\r
export interface Fragment {\r
  index: number;\r
  offsetUnits: number; // Fragment Offset field value (in 8-byte units)\r
  byteStart: number; // first payload byte this fragment carries\r
  size: number; // payload bytes in this fragment\r
  mf: boolean; // More-Fragments flag\r
}\r
\r
export interface FragResult {\r
  fragments: Fragment[];\r
  mtu: number;\r
  maxPayloadPerFrag: number; // largest payload that fits, rounded down to 8\r
}\r
\r
/** Fragment a payload of \`payloadSize\` bytes to fit a link \`mtu\` (incl. 20-byte header). */\r
export function fragment(payloadSize: number, mtu: number): FragResult {\r
  // payload room per fragment = MTU − header, rounded DOWN to a multiple of 8 (offsets are 8-byte units)\r
  const room = Math.max(8, Math.floor((mtu - IP_HEADER) / 8) * 8);\r
  const fragments: Fragment[] = [];\r
  let start = 0;\r
  let index = 0;\r
  if (payloadSize <= mtu - IP_HEADER) {\r
    // fits whole — a single, unfragmented packet (MF=0, offset 0). An unfragmented\r
    // packet may use the full payload room; only fragments need 8-byte alignment.\r
    return { fragments: [{ index: 0, offsetUnits: 0, byteStart: 0, size: payloadSize, mf: false }], mtu, maxPayloadPerFrag: room };\r
  }\r
  while (start < payloadSize) {\r
    const size = Math.min(room, payloadSize - start);\r
    const isLast = start + size >= payloadSize;\r
    fragments.push({ index, offsetUnits: start / 8, byteStart: start, size, mf: !isLast });\r
    start += size;\r
    index += 1;\r
  }\r
  return { fragments, mtu, maxPayloadPerFrag: room };\r
}\r
\r
/** Reassemble fragments (any order) back into the original payload length. */\r
export function reassemble(fragments: Fragment[]): { ok: boolean; totalBytes: number; complete: boolean } {\r
  const sorted = [...fragments].sort((a, b) => a.offsetUnits - b.offsetUnits);\r
  let expected = 0;\r
  for (const f of sorted) {\r
    if (f.offsetUnits * 8 !== expected) return { ok: false, totalBytes: expected, complete: false };\r
    expected += f.size;\r
  }\r
  const last = sorted[sorted.length - 1];\r
  const complete = !!last && !last.mf; // the final piece must have MF=0\r
  return { ok: true, totalBytes: expected, complete };\r
}\r
\r
export interface PmtudResult {\r
  delivered: boolean;\r
  icmp: { type: string; nextHopMtu: number } | null; // ICMP "fragmentation needed"\r
  newPacketSize: number; // what the sender should retry with\r
}\r
\r
/**\r
 * Path-MTU Discovery: a DF-set packet of \`packetSize\` (header+payload) meets a link\r
 * with \`linkMtu\`. If it doesn't fit, the router drops it and signals the smaller MTU.\r
 */\r
export function pmtud(packetSize: number, linkMtu: number): PmtudResult {\r
  if (packetSize <= linkMtu) return { delivered: true, icmp: null, newPacketSize: packetSize };\r
  return {\r
    delivered: false,\r
    icmp: { type: 'Destination Unreachable — Fragmentation Needed (Type 3, Code 4)', nextHopMtu: linkMtu },\r
    newPacketSize: linkMtu, // the sender retries at the next-hop MTU\r
  };\r
}\r
`;export{e as default};