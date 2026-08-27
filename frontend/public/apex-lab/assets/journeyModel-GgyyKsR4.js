var e=`// Journey / encapsulation derivation. Everything here comes from engine data:\r
// the dissection tree's \`child\` chain (the nested layers) and the builder's\r
// segments (the flat byte layout). The router re-wrap is produced by rebuilding\r
// the frame through the SAME specs with a next-hop connection (TTL-1, new MACs)\r
// and diffing the two dissections — so no protocol offsets live in the view.\r
import { buildFrame, DEFAULT_CONNECTION } from '../core/builder';\r
import { dissect } from '../core/engine';\r
import type { Connection, DissectionNode, Registry } from '../core/types';\r
\r
/** One layer in the encapsulation nest, outermost (depth 0) first. */\r
export interface JourneyLayer {\r
  depth: number;\r
  id: string;\r
  name: string;\r
  layer: number; // OSI-ish number\r
  headerBytes: number; // overhead this layer adds\r
  summary: string;\r
}\r
\r
/** A segment of the flat on-the-wire byte layout. */\r
export interface JourneySegment {\r
  id: string;\r
  label: string;\r
  length: number;\r
}\r
\r
/** A field whose value the router changed, before -> after (both really computed). */\r
export interface FieldChange {\r
  layer: string;\r
  field: string;\r
  before: string;\r
  after: string;\r
  beforeMeaning?: string;\r
  afterMeaning?: string;\r
}\r
\r
export interface JourneyModel {\r
  layers: JourneyLayer[]; // ethernet, ipv4, tcp …\r
  payloadLength: number;\r
  payloadAscii: string;\r
  trailerLength: number; // FCS\r
  segments: JourneySegment[]; // for the proportional bar\r
  totalBytes: number;\r
  frameBytes: number[]; // for the on-the-wire signal\r
  routerChanges: FieldChange[]; // what a hop rewrites\r
  recovered: string; // payload recovered by the engine (proves round-trip)\r
}\r
\r
// Example wire values for the next hop. Like DEFAULT_CONNECTION, these are just\r
// endpoint data used to BUILD a frame — not protocol logic.\r
const ROUTER_EGRESS_MAC = [0x00, 0x25, 0x96, 0xab, 0xcd, 0xef];\r
const NEXT_HOP_MAC = [0xfe, 0xed, 0xfa, 0xce, 0x00, 0x01];\r
\r
const ascii = (bytes: number[]) =>\r
  bytes.map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '·')).join('');\r
\r
/** Collect the layer chain and the innermost (leaf) node carrying the payload. */\r
function chain(root: DissectionNode): { layers: JourneyLayer[]; leaf: DissectionNode } {\r
  const layers: JourneyLayer[] = [];\r
  let node: DissectionNode = root;\r
  let depth = 0;\r
  for (;;) {\r
    const s = node.header.spec;\r
    layers.push({ depth, id: s.id, name: s.name, layer: s.layer, headerBytes: node.header.byteLength, summary: s.summary });\r
    if (!node.child) return { layers, leaf: node };\r
    node = node.child;\r
    depth++;\r
  }\r
}\r
\r
/** Walk two dissections in lockstep and report every field (and trailer) the router changed. */\r
function diffHops(a: DissectionNode, b: DissectionNode): FieldChange[] {\r
  const out: FieldChange[] = [];\r
  let na: DissectionNode | null = a;\r
  let nb: DissectionNode | null = b;\r
  while (na && nb) {\r
    const fa = na.header.fields;\r
    const fb = nb.header.fields;\r
    for (let i = 0; i < fa.length && i < fb.length; i++) {\r
      if (fa[i].display !== fb[i].display) {\r
        out.push({\r
          layer: na.header.spec.name,\r
          field: fa[i].field.label,\r
          before: fa[i].display,\r
          after: fb[i].display,\r
          beforeMeaning: fa[i].meaning,\r
          afterMeaning: fb[i].meaning,\r
        });\r
      }\r
    }\r
    if (na.trailer.length && na.trailer.join(',') !== nb.trailer.join(',')) {\r
      const hex = (bs: number[]) => bs.map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');\r
      out.push({\r
        layer: 'Frame',\r
        field: 'FCS / trailer',\r
        before: hex(na.trailer),\r
        after: hex(nb.trailer),\r
        beforeMeaning: 'CRC-32 over the frame',\r
        afterMeaning: 'recomputed for the new frame',\r
      });\r
    }\r
    na = na.child;\r
    nb = nb.child;\r
  }\r
  return out;\r
}\r
\r
/** Flat byte layout from any tree: each layer's header in order, then the leaf\r
 *  payload, then trailers (innermost-first, matching their physical position). */\r
function segmentsFromTree(tree: DissectionNode): { segments: JourneySegment[]; trailerLength: number } {\r
  const headers: JourneySegment[] = [];\r
  const trailers: { seg: JourneySegment; depth: number }[] = [];\r
  let leaf: DissectionNode = tree;\r
  let depth = 0;\r
  for (let n: DissectionNode | null = tree; n; n = n.child, depth++) {\r
    headers.push({ id: n.header.spec.id, label: \`\${n.header.spec.name} header\`, length: n.header.byteLength });\r
    // The Ethernet FCS (and any 802.3 zero-padding for short frames) surfaces as\r
    // trailing bytes past the innermost length-bounded layer: 4 bytes = the FCS\r
    // alone; more than 4 = zero-padding + FCS.\r
    if (n.trailer.length) trailers.push({ seg: { id: 'fcs', label: n.trailer.length > 4 ? 'padding + FCS' : 'FCS', length: n.trailer.length }, depth });\r
    if (!n.child) leaf = n;\r
  }\r
  const segments = [...headers];\r
  if (leaf.payload.length) segments.push({ id: 'payload', label: 'Payload', length: leaf.payload.length });\r
  trailers.sort((a, b) => b.depth - a.depth).forEach((t) => segments.push(t.seg));\r
  const trailerLength = trailers.reduce((s, t) => s + t.seg.length, 0);\r
  return { segments, trailerLength };\r
}\r
\r
/** Generic journey derived from ANY dissection tree (no router re-wrap). */\r
export function journeyFromTree(tree: DissectionNode): JourneyModel {\r
  const { layers, leaf } = chain(tree);\r
  const { segments, trailerLength } = segmentsFromTree(tree);\r
  return {\r
    layers,\r
    payloadLength: leaf.payload.length,\r
    payloadAscii: ascii(leaf.payload),\r
    trailerLength,\r
    segments,\r
    totalBytes: tree.raw.length,\r
    frameBytes: tree.raw,\r
    routerChanges: [],\r
    recovered: new TextDecoder().decode(Uint8Array.from(leaf.payload)),\r
  };\r
}\r
\r
/** The built-from-text journey: a full Ethernet/IPv4/TCP frame, with the router re-wrap. */\r
export function buildJourney(payload: number[], registry: Registry, conn: Connection = DEFAULT_CONNECTION): JourneyModel {\r
  const safe = payload.length ? payload : [0];\r
\r
  // Hop 1: as the sender puts it on the wire.\r
  const frame1 = buildFrame(safe, registry, conn);\r
  const tree1 = dissect(frame1.bytes, 'ethernet', registry);\r
\r
  // Hop 2: a router forwards it — same payload, decremented TTL, rewritten link layer.\r
  const hop2: Connection = { ...conn, srcMac: ROUTER_EGRESS_MAC, dstMac: NEXT_HOP_MAC, ttl: conn.ttl - 1 };\r
  const tree2 = dissect(buildFrame(safe, registry, hop2).bytes, 'ethernet', registry);\r
\r
  return { ...journeyFromTree(tree1), routerChanges: diffHops(tree1, tree2) };\r
}\r
`;export{e as default};