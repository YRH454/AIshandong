var e=`// Consistent hashing — how distributed caches and sharded databases spread keys\r
// across nodes so that adding or removing a node moves as FEW keys as possible.\r
// Both nodes and keys are hashed onto a ring (0..RING-1); a key belongs to the\r
// first node clockwise from its position. Add a node and only the keys in the arc\r
// behind it move; remove one and only its keys move to the next node. Naive\r
// hash-mod-N, by contrast, remaps almost every key when N changes. Pure, tested.\r
\r
export const RING = 1 << 16; // 65536 positions on the ring\r
\r
/** A small, stable string hash (FNV-1a, 32-bit) → position on the ring. */\r
export function hashRing(s: string): number {\r
  let h = 0x811c9dc5;\r
  for (let i = 0; i < s.length; i++) {\r
    h ^= s.charCodeAt(i);\r
    h = Math.imul(h, 0x01000193) >>> 0;\r
  }\r
  return h % RING;\r
}\r
\r
export interface VNode { pos: number; node: string; vIndex: number }\r
\r
export class HashRing {\r
  readonly replicas: number;\r
  private nodes = new Set<string>();\r
  private ring: VNode[] = []; // sorted by pos\r
\r
  constructor(replicas = 1) { this.replicas = Math.max(1, replicas); }\r
\r
  get nodeList(): string[] { return [...this.nodes].sort(); }\r
  get points(): VNode[] { return this.ring.slice(); }\r
\r
  addNode(node: string): void {\r
    if (this.nodes.has(node)) return;\r
    this.nodes.add(node);\r
    for (let v = 0; v < this.replicas; v++) this.ring.push({ pos: hashRing(\`\${node}#\${v}\`), node, vIndex: v });\r
    this.ring.sort((a, b) => a.pos - b.pos || a.node.localeCompare(b.node));\r
  }\r
\r
  removeNode(node: string): void {\r
    if (!this.nodes.delete(node)) return;\r
    this.ring = this.ring.filter((p) => p.node !== node);\r
  }\r
\r
  /** The node that owns \`key\`: the first vnode clockwise from the key's position. */\r
  lookup(key: string): string | null {\r
    if (this.ring.length === 0) return null;\r
    const h = hashRing(key);\r
    for (const p of this.ring) if (p.pos >= h) return p.node;\r
    return this.ring[0].node; // wrap around past the top of the ring\r
  }\r
\r
  /** Map every key in \`keys\` to its owning node. */\r
  distribution(keys: string[]): Record<string, string> {\r
    const out: Record<string, string> = {};\r
    for (const k of keys) out[k] = this.lookup(k) ?? '';\r
    return out;\r
  }\r
}\r
\r
/** Naive sharding for contrast: node = nodes[ hash(key) mod N ]. */\r
export function moduloAssign(key: string, nodes: string[]): string {\r
  if (nodes.length === 0) return '';\r
  return [...nodes].sort()[hashRing(key) % nodes.length];\r
}\r
\r
/** How many keys change owner between two distributions. */\r
export function movedKeys(before: Record<string, string>, after: Record<string, string>): number {\r
  let moved = 0;\r
  for (const k of Object.keys(before)) if (before[k] !== after[k]) moved++;\r
  return moved;\r
}\r
`;export{e as default};