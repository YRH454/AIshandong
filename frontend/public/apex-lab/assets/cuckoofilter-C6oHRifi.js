var e=`// Cuckoo filter — approximate set membership like a Bloom filter, but it supports DELETE (Bloom can't) and beats\r
// Bloom's space at low false-positive rates. It stores a short FINGERPRINT of each item in a cuckoo hash table where\r
// every item has two candidate buckets. The trick that makes it work is PARTIAL-KEY cuckoo hashing: a fingerprint's two\r
// buckets are i and i XOR hash(fingerprint), which is symmetric — so when a fingerprint is evicted you can move it to\r
// its other bucket knowing only the fingerprint, without ever storing (or having) the original key. Membership can false\r
// positive (two items sharing a fingerprint in the same bucket pair) but never false-negative on something inserted.\r
\r
export const BUCKETS = 8;   // must be a power of two for the XOR trick\r
export const SLOTS = 4;     // fingerprints per bucket\r
const MAX_KICKS = 32;\r
\r
export type Buckets = number[][]; // [bucket][slot] = fingerprint (a small nonzero int)\r
\r
const hash = (s: string): number => {\r
  let h = 2166136261 >>> 0;\r
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }\r
  return h >>> 0;\r
};\r
\r
export const fingerprint = (x: string): number => (hash(x + '#fp') & 0xff) || 1; // 1..255, never 0\r
export const bucket1 = (x: string): number => hash(x) & (BUCKETS - 1);\r
// The other candidate bucket for a fingerprint, from either of its buckets (self-inverse: alt(alt(i,f),f) === i).\r
export const altBucket = (i: number, f: number): number => (i ^ (hash('alt' + f) & (BUCKETS - 1))) & (BUCKETS - 1);\r
\r
export const empty = (): Buckets => Array.from({ length: BUCKETS }, () => []);\r
const clone = (b: Buckets): Buckets => b.map((slot) => [...slot]);\r
\r
export interface InsertResult { buckets: Buckets; ok: boolean; landed: number; kicks: number }\r
\r
export function insert(b0: Buckets, x: string): InsertResult {\r
  const b = clone(b0);\r
  const f = fingerprint(x);\r
  const i1 = bucket1(x), i2 = altBucket(i1, f);\r
  if (b[i1].length < SLOTS) { b[i1].push(f); return { buckets: b, ok: true, landed: i1, kicks: 0 }; }\r
  if (b[i2].length < SLOTS) { b[i2].push(f); return { buckets: b, ok: true, landed: i2, kicks: 0 }; }\r
  // both full — evict along a chain, relocating each victim to its other bucket via the XOR trick.\r
  let i = i2, cur = f;\r
  for (let k = 1; k <= MAX_KICKS; k++) {\r
    const victim = b[i][0];       // deterministic slot choice keeps the visualization reproducible\r
    b[i][0] = cur;\r
    cur = victim;\r
    i = altBucket(i, cur);\r
    if (b[i].length < SLOTS) { b[i].push(cur); return { buckets: b, ok: true, landed: i, kicks: k }; }\r
  }\r
  return { buckets: b0, ok: false, landed: -1, kicks: MAX_KICKS }; // table effectively full\r
}\r
\r
export function contains(b: Buckets, x: string): boolean {\r
  const f = fingerprint(x);\r
  const i1 = bucket1(x), i2 = altBucket(i1, f);\r
  return b[i1].includes(f) || b[i2].includes(f);\r
}\r
\r
export function remove(b0: Buckets, x: string): { buckets: Buckets; removed: boolean } {\r
  const b = clone(b0);\r
  const f = fingerprint(x);\r
  for (const i of [bucket1(x), altBucket(bucket1(x), f)]) {\r
    const j = b[i].indexOf(f);\r
    if (j !== -1) { b[i].splice(j, 1); return { buckets: b, removed: true }; }\r
  }\r
  return { buckets: b0, removed: false };\r
}\r
\r
export const load = (b: Buckets): number => b.reduce((n, s) => n + s.length, 0);\r
`;export{e as default};