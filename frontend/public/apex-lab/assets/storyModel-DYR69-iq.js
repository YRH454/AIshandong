var e=`// The Packet Story: a packet's whole life as one ordered, synchronized sequence.\r
// Each step spotlights a byte range, names the active layer, and explains WHY —\r
// derived entirely from the dissection tree + byte model + journey. One SimClock\r
// drives the byte strip, the layer stack, and the narration together. This is the\r
// thing only Apex does: the synchronization you otherwise do in your head.\r
import type { DissectionNode } from '../core/types';\r
import type { ByteModel } from './byteModel';\r
import type { JourneyModel } from './journeyModel';\r
\r
export interface StoryStep {\r
  id: string;\r
  title: string;\r
  narration: string;\r
  highlight: number[]; // byte indices to spotlight\r
  layerId: string | null; // the layer this step is about\r
  phase: 'down' | 'wire' | 'router' | 'up'; // for the stage indicator\r
}\r
\r
/** Byte indices owned by a given layer-depth + region, from the byte model. */\r
function indicesFor(model: ByteModel, pred: (depth: number, region: string) => boolean): number[] {\r
  return model.cells.filter((c) => pred(c.depth, c.region)).map((c) => c.index);\r
}\r
\r
const fieldVal = (node: DissectionNode, name: string): string => {\r
  const f = node.header.fields.find((p) => p.field.name === name);\r
  return f ? f.display : '';\r
};\r
\r
export function deriveStory(tree: DissectionNode, model: ByteModel, journey: JourneyModel, built = true): StoryStep[] {\r
  // Collect the layer nodes innermost-last (ethernet, ipv4, tcp).\r
  const nodes: DissectionNode[] = [];\r
  for (let n: DissectionNode | null = tree; n; n = n.child) nodes.push(n);\r
  const maxDepth = nodes.length - 1; // depth of the innermost header\r
  const leaf = nodes[nodes.length - 1];\r
\r
  const steps: StoryStep[] = [];\r
  const payloadIdx = indicesFor(model, (_, region) => region === 'payload');\r
\r
  // 1) The innermost data.\r
  const leafName = leaf.header.spec.name;\r
  steps.push({\r
    id: 'message',\r
    title: built ? 'Your message' : \`The \${leafName} data\`,\r
    narration: built\r
      ? (payloadIdx.length\r
          ? \`It starts as plain bytes: “\${journey.payloadAscii}” — \${journey.payloadLength} byte\${journey.payloadLength === 1 ? '' : 's'} of application data, nothing wrapped around it yet.\`\r
          : 'The application has bytes to send.')\r
      : \`At the core sits \${leafName} — \${leaf.header.spec.summary}\`,\r
    highlight: payloadIdx.length ? payloadIdx : indicesFor(model, (d) => d === maxDepth),\r
    layerId: leaf.header.spec.id,\r
    phase: 'down',\r
  });\r
\r
  // 2) Wrap it, innermost header first (TCP), out to Ethernet.\r
  for (let depth = maxDepth; depth >= 0; depth--) {\r
    const node = nodes[depth];\r
    const spec = node.header.spec;\r
    steps.push({\r
      id: \`wrap-\${spec.id}\`,\r
      title: \`Wrap in \${spec.name}\`,\r
      narration: \`\${spec.summary} \${layerWhy(spec.id, node)}\`.trim(),\r
      highlight: indicesFor(model, (d, region) => d === depth && region === 'header'),\r
      layerId: spec.id,\r
      phase: 'down',\r
    });\r
  }\r
\r
  // 3) On the wire.\r
  const headerTotal = journey.layers.reduce((s, l) => s + l.headerBytes, 0) + journey.trailerLength;\r
  steps.push({\r
    id: 'wire',\r
    title: 'On the wire',\r
    narration: \`The finished frame — \${journey.totalBytes} bytes — goes out as a voltage/optical signal. Your \${journey.payloadLength}-byte message now rides inside \${headerTotal} bytes of headers and the CRC-32 trailer.\`,\r
    highlight: model.cells.map((c) => c.index),\r
    layerId: null,\r
    phase: 'wire',\r
  });\r
\r
  // 4) Through a router (if this is a routed Ethernet/IPv4 frame).\r
  if (journey.routerChanges.length) {\r
    const changed = journey.routerChanges.map((c) => \`\${c.field} \${c.before}→\${c.after}\`).join(', ');\r
    steps.push({\r
      id: 'router',\r
      title: 'Through a router',\r
      narration: \`A router forwards it to the next hop: it rewrites the link layer and decrements the TTL, then recomputes everything that depends on those bytes — \${changed}. End-to-end fields (IPs, ports, seq) are untouched.\`,\r
      highlight: indicesFor(model, (d, region) => (d <= 1 && region === 'header') || region === 'trailer'),\r
      layerId: 'ipv4',\r
      phase: 'router',\r
    });\r
  }\r
\r
  // 5) Unwrap at the receiver, outermost header first, down to the message.\r
  for (let depth = 0; depth <= maxDepth; depth++) {\r
    const spec = nodes[depth].header.spec;\r
    steps.push({\r
      id: \`peel-\${spec.id}\`,\r
      title: \`Peel off \${spec.name}\`,\r
      narration: \`The receiver checks and strips the \${spec.name} header, handing the bytes inside up to the next layer.\`,\r
      highlight: indicesFor(model, (d, region) => d === depth && region === 'header'),\r
      layerId: spec.id,\r
      phase: 'up',\r
    });\r
  }\r
\r
  // 6) Delivered.\r
  steps.push({\r
    id: 'deliver',\r
    title: 'Delivered',\r
    narration: built\r
      ? \`The application gets back exactly what was sent: “\${journey.recovered}”. Every wrapper is removed; nothing was faked along the way.\`\r
      : \`Every header is stripped and the \${leafName} payload is handed up to the application.\`,\r
    highlight: payloadIdx.length ? payloadIdx : indicesFor(model, (d) => d === maxDepth),\r
    layerId: leaf.header.spec.id,\r
    phase: 'up',\r
  });\r
\r
  return steps;\r
}\r
\r
/** A short, RFC-grounded "why" per known layer, using real field values. */\r
function layerWhy(id: string, node: DissectionNode): string {\r
  switch (id) {\r
    case 'tcp':\r
      return \`Ports \${fieldVal(node, 'srcPort')}→\${fieldVal(node, 'dstPort')} name the apps; the sequence number lets the far end reassemble the byte stream in order.\`;\r
    case 'udp':\r
      return \`Ports \${fieldVal(node, 'srcPort')}→\${fieldVal(node, 'dstPort')} name the apps — but there's no handshake or ordering, just a length and a checksum.\`;\r
    case 'ipv4':\r
      return \`Source \${fieldVal(node, 'srcIp')} and destination \${fieldVal(node, 'dstIp')} let routers carry it across networks; TTL \${fieldVal(node, 'ttl')} stops it looping forever.\`;\r
    case 'ipv6':\r
      return \`128-bit source and destination addresses carry it across networks, with a hop limit instead of TTL.\`;\r
    case 'ethernet':\r
      return \`MAC addresses move it across this one physical link; a CRC-32 trailer lets the next device detect corruption.\`;\r
    default:\r
      return '';\r
  }\r
}\r
`;export{e as default};