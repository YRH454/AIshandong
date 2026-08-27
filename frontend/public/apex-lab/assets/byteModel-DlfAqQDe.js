var e=`// Byte/anatomy derivation. Flattens a DissectionNode tree into a per-byte\r
// attribution array: every byte of the frame is mapped to the layer and the\r
// field(s) that own it, using each ParsedField's absolute bitOffset/bits.\r
// Pure (no React/DOM) so it is testable and reusable; it names no protocol.\r
import type { DissectionNode, Field, ParsedField } from '../core/types';\r
\r
/** The slice of a single byte that one field covers, MSB-first (bit 0 = MSB). */\r
export interface FieldSlice {\r
  field: ParsedField;\r
  hiBit: number; // first bit of this byte the field covers (0..7, 0 = MSB)\r
  loBit: number; // last bit of this byte the field covers  (0..7, inclusive)\r
  fieldKey: string; // stable key: \`\${depth}:\${field.name}\` — for colour + legend\r
  isFieldStart: boolean; // true on the field's first byte\r
}\r
\r
/** One byte of the frame, fully attributed. */\r
export interface ByteCell {\r
  index: number; // absolute byte index in the frame\r
  value: number; // 0..255\r
  depth: number; // 0 = outermost (Ethernet), increasing up the stack\r
  layerId: string; // owning protocol id (e.g. 'tcp')\r
  layerName: string; // owning protocol name (e.g. 'TCP')\r
  layerSummary: string; // owning protocol's one-line teaching summary\r
  region: 'header' | 'payload' | 'trailer';\r
  slices: FieldSlice[]; // header fields overlapping this byte ([] for payload/trailer)\r
}\r
\r
/** A layer summary for the legend, in stack order. */\r
export interface LayerInfo {\r
  depth: number;\r
  id: string;\r
  name: string;\r
  fields: { name: string; label: string; fieldKey: string }[];\r
}\r
\r
export interface ByteModel {\r
  cells: ByteCell[];\r
  layers: LayerInfo[];\r
}\r
\r
/** Bytes a field occupies within a byte window [byteStart*8, +8). */\r
function sliceForByte(\r
  field: Field,\r
  absFieldStart: number,\r
  byteAbsBit: number,\r
): { hiBit: number; loBit: number } | null {\r
  const absFieldEnd = absFieldStart + field.bits; // exclusive\r
  const winStart = byteAbsBit;\r
  const winEnd = byteAbsBit + 8;\r
  if (absFieldStart >= winEnd || absFieldEnd <= winStart) return null;\r
  const hi = Math.max(absFieldStart, winStart) - winStart;\r
  const lo = Math.min(absFieldEnd, winEnd) - winStart - 1;\r
  return { hiBit: hi, loBit: lo };\r
}\r
\r
/** Walk the dissection tree, emitting one ByteCell per byte of the frame. */\r
export function buildByteModel(root: DissectionNode): ByteModel {\r
  const cells: ByteCell[] = [];\r
  const layers: LayerInfo[] = [];\r
\r
  const walk = (node: DissectionNode, absOffset: number, depth: number): void => {\r
    const spec = node.header.spec;\r
    const hdrLen = node.header.byteLength;\r
\r
    layers.push({\r
      depth,\r
      id: spec.id,\r
      name: spec.name,\r
      fields: node.header.fields.map((p) => ({\r
        name: p.field.name,\r
        label: p.field.label,\r
        fieldKey: \`\${depth}:\${p.field.name}\`,\r
      })),\r
    });\r
\r
    // Header bytes — attribute each to the overlapping field(s).\r
    for (let b = 0; b < hdrLen; b++) {\r
      const index = absOffset + b;\r
      const byteAbsBit = b * 8; // relative to this PDU; field.bitOffset is too\r
      const slices: FieldSlice[] = [];\r
      for (const p of node.header.fields) {\r
        const s = sliceForByte(p.field, p.bitOffset, byteAbsBit);\r
        if (!s) continue;\r
        slices.push({\r
          field: p,\r
          hiBit: s.hiBit,\r
          loBit: s.loBit,\r
          fieldKey: \`\${depth}:\${p.field.name}\`,\r
          // The field's first byte is the one whose window contains its bitOffset.\r
          isFieldStart: p.bitOffset >= byteAbsBit && p.bitOffset < byteAbsBit + 8,\r
        });\r
      }\r
      cells.push({\r
        index,\r
        value: node.raw[b],\r
        depth,\r
        layerId: spec.id,\r
        layerName: spec.name,\r
        layerSummary: spec.summary,\r
        region: 'header',\r
        slices,\r
      });\r
    }\r
\r
    const payloadStart = absOffset + hdrLen;\r
    if (node.child) {\r
      walk(node.child, payloadStart, depth + 1);\r
    } else {\r
      // Leaf payload bytes belong to this layer.\r
      for (let i = 0; i < node.payload.length; i++) {\r
        cells.push({\r
          index: payloadStart + i,\r
          value: node.payload[i],\r
          depth,\r
          layerId: spec.id,\r
          layerName: spec.name,\r
          layerSummary: spec.summary,\r
          region: 'payload',\r
          slices: [],\r
        });\r
      }\r
    }\r
\r
    // Trailer bytes (FCS / padding) sit after header+payload of this node.\r
    const trailerStart = payloadStart + node.payload.length;\r
    for (let i = 0; i < node.trailer.length; i++) {\r
      cells.push({\r
        index: trailerStart + i,\r
        value: node.trailer[i],\r
        depth,\r
        layerId: spec.id,\r
        layerName: spec.name,\r
        layerSummary: spec.summary,\r
        region: 'trailer',\r
        slices: [],\r
      });\r
    }\r
  };\r
\r
  walk(root, 0, 0);\r
  cells.sort((a, b) => a.index - b.index);\r
  return { cells, layers };\r
}\r
`;export{e as default};