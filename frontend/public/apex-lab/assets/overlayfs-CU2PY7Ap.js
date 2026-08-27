var e=`// OverlayFS — how a container image is a filesystem. An image is a stack of read-only LOWER layers; a running\r
// container adds one writable UPPER layer on top. The kernel unions them into a single MERGED view the process sees\r
// as "/": for any path, the TOPMOST layer that has it wins. The trick is COPY-UP — reading a file serves it from\r
// whichever lower layer holds it, but WRITING copies it up into the upper layer first, so the shared image layers\r
// stay pristine (which is why 100 containers share one image yet each has its own diff). Deleting a lower file writes\r
// a WHITEOUT in the upper layer to hide it. Modelled: union resolution, copy-up, and whiteout.\r
\r
export type Entry = { content: string } | { whiteout: true };\r
export type Layer = { name: string; readOnly: boolean; files: Record<string, Entry> };\r
export type Stack = Layer[]; // bottom (index 0) → top; the last, writable layer is the container's "upper"\r
\r
const isWhiteout = (e: Entry | undefined): e is { whiteout: true } => !!e && 'whiteout' in e;\r
\r
// The topmost layer that mentions \`path\` (whether a file or a whiteout), scanning upper→lower. null if no layer has it.\r
export function resolve(stack: Stack, path: string): { index: number; entry: Entry } | null {\r
  for (let i = stack.length - 1; i >= 0; i--) {\r
    const e = stack[i].files[path];\r
    if (e) return { index: i, entry: e };\r
  }\r
  return null;\r
}\r
\r
// Read through the union: the content from the winning layer, or null if the path doesn't exist or is whited out.\r
export function read(stack: Stack, path: string): { content: string; layer: number } | null {\r
  const r = resolve(stack, path);\r
  if (!r || isWhiteout(r.entry)) return null;\r
  return { content: r.entry.content, layer: r.index };\r
}\r
\r
// Every visible path in the merged view → its winning content (whiteouts and shadowed lower copies excluded).\r
export function merged(stack: Stack): Record<string, string> {\r
  const out: Record<string, string> = {};\r
  const paths = new Set<string>();\r
  for (const l of stack) for (const p of Object.keys(l.files)) paths.add(p);\r
  for (const p of paths) { const r = read(stack, p); if (r) out[p] = r.content; }\r
  return out;\r
}\r
\r
const withUpper = (stack: Stack, files: Record<string, Entry>): Stack =>\r
  stack.map((l, i) => (i === stack.length - 1 ? { ...l, files } : l)); // replace only the upper; lowers keep identity\r
\r
// Write a path: copy-up. The new content lands in the UPPER layer; lower layers are never touched. \`copiedUp\` is true\r
// when the path already existed in a lower layer (so this write shadowed it) rather than being brand new.\r
export function write(stack: Stack, path: string, content: string): { stack: Stack; copiedUp: boolean } {\r
  const upper = stack[stack.length - 1];\r
  const existedBelow = stack.slice(0, -1).some((l) => l.files[path] && !isWhiteout(l.files[path]));\r
  const copiedUp = existedBelow && !(path in upper.files);\r
  return { stack: withUpper(stack, { ...upper.files, [path]: { content } }), copiedUp };\r
}\r
\r
// Delete a path from the merged view. If it exists in a lower layer we can't remove it there (read-only), so we write\r
// a WHITEOUT in the upper layer to hide it; if it only lived in the upper, we just drop it.\r
export function remove(stack: Stack, path: string): { stack: Stack; whiteout: boolean } {\r
  const upper = stack[stack.length - 1];\r
  const inLower = stack.slice(0, -1).some((l) => l.files[path] && !isWhiteout(l.files[path]));\r
  const files = { ...upper.files };\r
  if (inLower) { files[path] = { whiteout: true }; return { stack: withUpper(stack, files), whiteout: true }; }\r
  delete files[path];\r
  return { stack: withUpper(stack, files), whiteout: false };\r
}\r
`;export{e as default};