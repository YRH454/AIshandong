var e=`// ECMP — Equal-Cost Multi-Path. When a router has several equally-good next-hops to a destination\r
// (a fat spine-leaf fabric, or two parallel uplinks), it spreads traffic across them. The catch: it\r
// can't just round-robin packets, or a single TCP flow's packets would arrive out of order. Instead it\r
// hashes each packet's FLOW identity — the 5-tuple (src IP, dst IP, src port, dst port, protocol) —\r
// and uses the hash to pick a next-hop. Every packet of one flow hashes the same, so the flow stays on\r
// ONE path (in order); different flows scatter across paths. The famous failure is POLARIZATION: if\r
// every router in a multi-tier fabric hashes identically, a flow that goes "left" at tier 1 goes left\r
// at tier 2 too, so the cross paths starve. The fix is a per-router hash seed. Pure model, tested.\r
\r
export interface Flow { srcIp: string; dstIp: string; srcPort: number; dstPort: number; proto: string }\r
\r
const fnv1a = (s: string): number => {\r
  let h = 0x811c9dc5;\r
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }\r
  return h >>> 0;\r
};\r
// Murmur3 fmix32 finalizer. Raw FNV already responds to the seed, but POORLY DECORRELATED: across two\r
// seeds the per-flow path choice is a fixed permutation of itself, so two cascaded tiers stay correlated\r
// and only the n diagonal links carry traffic. The avalanche breaks that cross-seed correlation, so a\r
// per-router seed truly scatters flows across the full n×n mesh (the polarization fix).\r
const fmix32 = (h: number): number => {\r
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);\r
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);\r
  h ^= h >>> 16; return h >>> 0;\r
};\r
\r
/** Hash a flow's 5-tuple (salted by a per-router seed) — the value the router spreads on. */\r
export const hashFlow = (f: Flow, seed: number): number => fmix32(fnv1a(\`\${seed}|\${f.srcIp}|\${f.dstIp}|\${f.srcPort}|\${f.dstPort}|\${f.proto}\`));\r
\r
/** Choose one of \`n\` equal-cost next-hops for a flow. Deterministic ⇒ the whole flow stays on it. */\r
export const pickPath = (f: Flow, n: number, seed: number): number => hashFlow(f, seed) % n;\r
\r
/** How many flows land on each of the n paths. */\r
export function distribute(flows: Flow[], n: number, seed: number): number[] {\r
  const counts = new Array(n).fill(0);\r
  for (const f of flows) counts[pickPath(f, n, seed)]++;\r
  return counts;\r
}\r
\r
export interface TwoStage { used: number; total: number; matrix: number[][] }\r
\r
/** Two cascaded routers (n paths each). With the SAME seed a flow takes the same index at both tiers,\r
 *  so only the diagonal links carry traffic (polarization). Different seeds light up the full mesh. */\r
export function twoStageLinks(flows: Flow[], n: number, seed1: number, seed2: number): TwoStage {\r
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));\r
  for (const f of flows) matrix[pickPath(f, n, seed1)][pickPath(f, n, seed2)]++;\r
  let used = 0;\r
  for (const row of matrix) for (const c of row) if (c > 0) used++;\r
  return { used, total: n * n, matrix };\r
}\r
\r
/** A spread of test flows (same endpoints, varying source port — the usual entropy source). */\r
export const makeFlows = (count: number): Flow[] =>\r
  Array.from({ length: count }, (_, i) => ({ srcIp: '10.0.0.5', dstIp: '10.0.9.9', srcPort: 1024 + i, dstPort: 443, proto: 'TCP' }));\r
`;export{e as default};