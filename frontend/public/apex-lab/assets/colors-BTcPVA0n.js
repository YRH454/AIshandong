var e=`// Deterministic colours for the byte grid. Each layer gets a base hue so its\r
// bytes read as a group; fields within a layer vary in lightness so neighbours\r
// stay distinguishable. Keyed by fieldKey (\`\${depth}:\${name}\`) — no protocol\r
// names appear here, only stack depth.\r
const LAYER_HUE = [212, 150, 28, 280, 330]; // depth 0,1,2,... cycles\r
\r
export function layerHue(depth: number): number {\r
  return LAYER_HUE[depth % LAYER_HUE.length];\r
}\r
\r
/** Colour for a header field, varying lightness by the field's index in its layer. */\r
export function fieldColor(depth: number, fieldIndex: number, fieldCount: number): string {\r
  const hue = layerHue(depth);\r
  // spread lightness across 38%..64% so adjacent fields alternate clearly\r
  const t = fieldCount > 1 ? fieldIndex / (fieldCount - 1) : 0.5;\r
  const light = 40 + t * 22;\r
  const sat = 58 - (fieldIndex % 2) * 14; // alternate saturation too\r
  return \`hsl(\${hue} \${sat}% \${light}%)\`;\r
}\r
\r
export const PAYLOAD_COLOR = 'hsl(280 30% 46%)';\r
export const TRAILER_COLOR = 'hsl(220 8% 42%)';\r
`;export{e as default};