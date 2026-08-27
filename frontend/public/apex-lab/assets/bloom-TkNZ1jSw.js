var e=`// Bloom filter — a tiny probabilistic set that answers "have I seen this?" with\r
// "definitely not" or "possibly yes". An m-bit array and k hash functions: adding x\r
// sets the k bits hash_i(x); querying x checks those k bits. If ANY is 0, x was\r
// definitely never added (no false negatives, ever). If ALL are 1, x is *probably*\r
// present — but other items may have set those bits, so it can be a false positive.\r
// The FP probability rises as the array fills: ≈ (1 − e^(−kn/m))^k. Pure, tested.\r
\r
/** k independent positions for \`key\` in an m-bit array (double hashing, Kirsch–Mitzenmacher). */\r
export function positions(key: string, m: number, k: number): number[] {\r
  // two base hashes (FNV-1a variants) combined into k indices\r
  let h1 = 0x811c9dc5;\r
  for (let i = 0; i < key.length; i++) { h1 ^= key.charCodeAt(i); h1 = Math.imul(h1, 0x01000193) >>> 0; }\r
  let h2 = 0x9e3779b1 ^ key.length;\r
  for (let i = 0; i < key.length; i++) { h2 = Math.imul(h2 ^ key.charCodeAt(i), 0x85ebca77) >>> 0; }\r
  const out: number[] = [];\r
  for (let i = 0; i < k; i++) out.push(((h1 + Math.imul(i, h2)) >>> 0) % m);\r
  return out;\r
}\r
\r
export type Verdict = 'definitely-not' | 'possibly';\r
\r
export class BloomFilter {\r
  readonly m: number;\r
  readonly k: number;\r
  readonly bits: Uint8Array;\r
  private added = new Set<string>(); // kept only to MEASURE false positives, not used by query\r
  private count = 0;\r
\r
  constructor(m: number, k: number) {\r
    this.m = Math.max(1, m);\r
    this.k = Math.max(1, k);\r
    this.bits = new Uint8Array(this.m);\r
  }\r
\r
  get n(): number { return this.count; }\r
  get setBits(): number { let c = 0; for (const b of this.bits) if (b) c++; return c; }\r
\r
  add(key: string): void {\r
    for (const p of positions(key, this.m, this.k)) this.bits[p] = 1;\r
    this.added.add(key);\r
    this.count++;\r
  }\r
\r
  /** Membership test — never a false negative; "possibly" may be a false positive. */\r
  query(key: string): { verdict: Verdict; positions: number[]; allSet: boolean } {\r
    const ps = positions(key, this.m, this.k);\r
    const allSet = ps.every((p) => this.bits[p] === 1);\r
    return { verdict: allSet ? 'possibly' : 'definitely-not', positions: ps, allSet };\r
  }\r
\r
  /** Was this key actually added? (Ground truth, for detecting false positives.) */\r
  wasAdded(key: string): boolean { return this.added.has(key); }\r
\r
  /** Theoretical false-positive probability for the current load: (1 − e^(−kn/m))^k. */\r
  theoreticalFpRate(): number {\r
    return Math.pow(1 - Math.exp((-this.k * this.count) / this.m), this.k);\r
  }\r
}\r
\r
/** Empirically measure the FP rate over a set of keys known NOT to be in the filter. */\r
export function measureFpRate(bf: BloomFilter, absentKeys: string[]): number {\r
  if (absentKeys.length === 0) return 0;\r
  let fp = 0;\r
  for (const key of absentKeys) if (bf.query(key).verdict === 'possibly') fp++;\r
  return fp / absentKeys.length;\r
}\r
`;export{e as default};