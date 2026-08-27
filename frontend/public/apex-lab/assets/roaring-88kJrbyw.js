var e=`// Roaring bitmaps — how databases store a set of millions of integer IDs compactly AND intersect two of them\r
// at memory speed. A plain bitmap over a 32-bit key space is 512 MB whether you store 3 IDs or 3 billion; a\r
// sorted array is tiny for 3 IDs but slow to intersect. Roaring gets the best of both by splitting the key\r
// space into 2^16 "chunks" (the high 16 bits pick the chunk; the low 16 bits are the position inside it) and\r
// storing each chunk in whichever CONTAINER is smallest for its density:\r
//   • array container  — a sorted list of the low-16-bit values, when the chunk is sparse (≤ 4096 values)\r
//   • bitmap container — a flat 2^16-bit (8 KB) bitmap, when the chunk is dense\r
// (real Roaring adds a third "run" container for long consecutive spans; we model the two main ones.) Because\r
// every chunk is bounded to 65536 values, operations stay cache-friendly, and AND/OR run container-by-chunk —\r
// array∩array by merge, bitmap∩bitmap by word AND — so intersecting two huge sets touches only shared chunks.\r
// It's the workhorse index format in Lucene/Elasticsearch, Druid, ClickHouse, Spark. Reference: Lemire et al.,\r
// "Better bitmap performance with Roaring bitmaps" (2016).\r
\r
const CHUNK = 65536;          // values per chunk (low 16 bits)\r
const ARRAY_MAX = 4096;       // above this, an array container is bigger than a bitmap → convert\r
\r
type ArrayC = { kind: 'array'; values: number[] };          // sorted, distinct uint16\r
type BitmapC = { kind: 'bitmap'; words: Uint8Array };        // 8192 bytes = 65536 bits\r
type Container = ArrayC | BitmapC;\r
\r
const hi = (key: number) => Math.floor(key / CHUNK);\r
const lo = (key: number) => key % CHUNK;\r
\r
export class Roaring {\r
  private chunks = new Map<number, Container>();\r
\r
  add(key: number): void {\r
    const h = hi(key), l = lo(key);\r
    let c = this.chunks.get(h);\r
    if (!c) { c = { kind: 'array', values: [] }; this.chunks.set(h, c); }\r
    if (c.kind === 'array') {\r
      const i = lowerBound(c.values, l);\r
      if (c.values[i] === l) return;             // already present\r
      c.values.splice(i, 0, l);\r
      if (c.values.length > ARRAY_MAX) this.chunks.set(h, toBitmap(c)); // densified → switch container\r
    } else {\r
      c.words[l >> 3] |= 1 << (l & 7);\r
    }\r
  }\r
\r
  has(key: number): boolean {\r
    const c = this.chunks.get(hi(key)); if (!c) return false;\r
    const l = lo(key);\r
    return c.kind === 'array' ? c.values[lowerBound(c.values, l)] === l : (c.words[l >> 3] & (1 << (l & 7))) !== 0;\r
  }\r
\r
  cardinality(): number {\r
    let n = 0;\r
    for (const c of this.chunks.values()) n += count(c);\r
    return n;\r
  }\r
\r
  /** All present keys, ascending — for checking against a ground-truth set. */\r
  toArray(): number[] {\r
    const out: number[] = [];\r
    for (const h of [...this.chunks.keys()].sort((a, b) => a - b)) {\r
      const c = this.chunks.get(h)!;\r
      if (c.kind === 'array') for (const l of c.values) out.push(h * CHUNK + l);\r
      else for (let l = 0; l < CHUNK; l++) if (c.words[l >> 3] & (1 << (l & 7))) out.push(h * CHUNK + l);\r
    }\r
    return out;\r
  }\r
\r
  /** Per-chunk container report — the whole point of Roaring: which representation each chunk chose. */\r
  containers(): { chunk: number; kind: 'array' | 'bitmap'; count: number; bytes: number }[] {\r
    return [...this.chunks.entries()].sort((a, b) => a[0] - b[0]).map(([chunk, c]) => ({\r
      chunk, kind: c.kind, count: count(c),\r
      bytes: c.kind === 'array' ? c.values.length * 2 : 8192, // uint16 each vs a flat 8 KB bitmap\r
    }));\r
  }\r
\r
  static from(keys: number[]): Roaring { const r = new Roaring(); for (const k of keys) r.add(k); return r; }\r
  static or(a: Roaring, b: Roaring): Roaring { return Roaring.from([...a.toArray(), ...b.toArray()]); }\r
  static and(a: Roaring, b: Roaring): Roaring {\r
    const out = new Roaring(); for (const k of a.toArray()) if (b.has(k)) out.add(k); return out;\r
  }\r
}\r
\r
function lowerBound(arr: number[], v: number): number {\r
  let lo2 = 0, hi2 = arr.length;\r
  while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (arr[m] < v) lo2 = m + 1; else hi2 = m; }\r
  return lo2;\r
}\r
function toBitmap(a: ArrayC): BitmapC {\r
  const words = new Uint8Array(8192);\r
  for (const l of a.values) words[l >> 3] |= 1 << (l & 7);\r
  return { kind: 'bitmap', words };\r
}\r
function count(c: Container): number {\r
  if (c.kind === 'array') return c.values.length;\r
  let n = 0; for (const byte of c.words) n += popcount(byte); return n;\r
}\r
function popcount(b: number): number { let n = 0; while (b) { n += b & 1; b >>= 1; } return n; }\r
`;export{e as default};