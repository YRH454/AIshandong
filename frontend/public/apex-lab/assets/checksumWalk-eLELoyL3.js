var e=`// Step-by-step walkthrough of an Internet checksum (RFC 1071) over a header,\r
// for the animated checksum view. Pure — the view just renders these steps.\r
// It also locates which dissected layer carries a header-only checksum, by the\r
// field's label, so no protocol id or offset is hardcoded.\r
import type { DissectionNode } from '../core/types';\r
\r
export interface CkStep {\r
  index: number; // word index\r
  hi: number; // high byte\r
  lo: number; // low byte\r
  word: number; // 16-bit word (checksum field shows as 0x0000)\r
  isChecksumField: boolean;\r
  running: number; // 32-bit running sum after adding this word\r
}\r
\r
export interface CkWalk {\r
  layerName: string;\r
  steps: CkStep[];\r
  rawSum: number; // before folding carries\r
  folded: number; // after folding carries into 16 bits\r
  result: number; // ones-complement -> the checksum\r
  stored: number; // the checksum actually in the header\r
  ok: boolean; // result === stored\r
}\r
\r
export interface CkTarget {\r
  layerName: string;\r
  headerBytes: number[]; // the header only\r
  checksumByteOffset: number; // byte offset of the 16-bit checksum within the header\r
}\r
\r
/** Find the dissected layer whose header carries its own (header-only) checksum. */\r
export function findHeaderChecksum(root: DissectionNode): CkTarget | null {\r
  let node: DissectionNode | null = root;\r
  while (node) {\r
    const cs = node.header.fields.find((p) => /header checksum/i.test(p.field.label));\r
    if (cs) {\r
      return {\r
        layerName: node.header.spec.name,\r
        headerBytes: node.raw.slice(0, node.header.byteLength),\r
        checksumByteOffset: cs.bitOffset / 8,\r
      };\r
    }\r
    node = node.child;\r
  }\r
  return null;\r
}\r
\r
/** Run the ones-complement sum over a header, zeroing the checksum field itself. */\r
export function checksumWalk(target: CkTarget): CkWalk {\r
  const { headerBytes, checksumByteOffset } = target;\r
  const steps: CkStep[] = [];\r
  let running = 0;\r
  for (let i = 0; i + 1 < headerBytes.length; i += 2) {\r
    const isChecksumField = i === checksumByteOffset;\r
    const hi = isChecksumField ? 0 : headerBytes[i];\r
    const lo = isChecksumField ? 0 : headerBytes[i + 1];\r
    const word = (hi << 8) | lo;\r
    running += word;\r
    steps.push({ index: i / 2, hi, lo, word, isChecksumField, running });\r
  }\r
  const rawSum = running;\r
  let folded = running;\r
  while (folded >> 16) folded = (folded & 0xffff) + (folded >> 16);\r
  const result = ~folded & 0xffff;\r
  const stored = ((headerBytes[checksumByteOffset] << 8) | headerBytes[checksumByteOffset + 1]) & 0xffff;\r
  return { layerName: target.layerName, steps, rawSum, folded, result, stored, ok: result === stored };\r
}\r
`;export{e as default};