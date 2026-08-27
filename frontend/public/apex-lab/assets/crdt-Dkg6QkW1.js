var e=`// CRDTs — conflict-free replicated data types. Replicas edit independently while\r
// offline and later merge with NO coordination and NO conflicts, because the merge is a\r
// join in a semilattice: commutative, associative, and idempotent. So every replica\r
// that has seen the same set of updates converges to the same value, regardless of\r
// message order, duplication, or delay. We model a G-Counter (grow-only) and a\r
// last-write-wins register. Pure, deterministic; the lattice laws are tested.\r
\r
// ── G-Counter: one count per replica; merge = elementwise max; value = sum ──\r
export type GCounter = Record<string, number>;\r
\r
export const gIncrement = (c: GCounter, replica: string, by = 1): GCounter => ({ ...c, [replica]: (c[replica] ?? 0) + by });\r
\r
export function gMerge(a: GCounter, b: GCounter): GCounter {\r
  const out: GCounter = { ...a };\r
  for (const k in b) out[k] = Math.max(out[k] ?? 0, b[k]);\r
  return out;\r
}\r
\r
export const gValue = (c: GCounter): number => Object.values(c).reduce((s, n) => s + n, 0);\r
\r
// ── LWW-Register: value tagged with a timestamp; higher timestamp wins ──\r
export interface LWW { value: string; ts: number; replica: string }\r
\r
export function lwwMerge(a: LWW, b: LWW): LWW {\r
  // tiebreak chain (ts, then replica, then value) must be TOTAL so the result is the same\r
  // regardless of argument order — otherwise replicas merging in different orders diverge\r
  if (a.ts !== b.ts) return a.ts > b.ts ? a : b;\r
  if (a.replica !== b.replica) return a.replica > b.replica ? a : b;\r
  return a.value >= b.value ? a : b; // last resort: order-independent on the value itself\r
}\r
`;export{e as default};