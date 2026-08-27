var e=`// Content-Defined Chunking (CDC) — how rsync, restic, borg, Dropbox and ZFS dedup avoid re-sending data\r
// that barely changed. Split a file into chunks and store/transfer each chunk only once (keyed by its\r
// hash). The catch is WHERE to cut. Fixed-size chunking (every N bytes) is catastrophically fragile: insert\r
// ONE byte at the front and every subsequent boundary shifts, so every chunk hash changes and nothing\r
// dedupes — "the boundary-shift problem". CDC instead cuts where the *content* says to: roll a hash over a\r
// small sliding window and place a boundary whenever the low bits hit a target pattern. Because the\r
// decision depends only on local bytes, an edit perturbs just the chunk(s) it touches; every other\r
// boundary — and chunk — survives. That's what makes incremental backup and sync cheap. References:\r
// Muthitacharoen et al., LBFS (SOSP 2001); the Rabin-fingerprint CDC family.\r
\r
export interface Chunk { start: number; len: number; hash: number }\r
\r
const WINDOW = 4;     // rolling-hash window (bytes)\r
const BASE = 257;     // polynomial base\r
\r
const fnv = (bytes: number[], start: number, len: number): number => {\r
  let h = 0x811c9dc5 >>> 0;\r
  for (let i = start; i < start + len; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }\r
  return h >>> 0;\r
};\r
\r
/** Fixed-size chunking: cut every \`size\` bytes, no matter the content. Simple, and fragile under edits. */\r
export function fixedChunks(bytes: number[], size: number): Chunk[] {\r
  const out: Chunk[] = [];\r
  for (let s = 0; s < bytes.length; s += size) {\r
    const len = Math.min(size, bytes.length - s);\r
    out.push({ start: s, len, hash: fnv(bytes, s, len) });\r
  }\r
  return out;\r
}\r
\r
/** Content-defined chunking: a continuous rolling hash over a WINDOW-byte window places a boundary wherever\r
 *  (hash & mask) === 0, with min/max length guards. \`avgSize\` sets the mask (avgSize-1), so boundaries land\r
 *  on average every avgSize bytes. Boundaries depend only on local content → shift-resistant. */\r
export function cdcChunks(bytes: number[], opts: { minSize: number; avgSize: number; maxSize: number }): Chunk[] {\r
  const { minSize, avgSize, maxSize } = opts;\r
  const mask = avgSize - 1; // avgSize must be a power of two for an even distribution\r
  let bw = 1; for (let k = 0; k < WINDOW; k++) bw = Math.imul(bw, BASE) >>> 0; // BASE^WINDOW\r
  const out: Chunk[] = [];\r
  let start = 0, h = 0;\r
  for (let i = 0; i < bytes.length; i++) {\r
    h = (Math.imul(h, BASE) + bytes[i]) >>> 0;            // add the new byte\r
    if (i >= WINDOW) h = (h - Math.imul(bytes[i - WINDOW], bw)) >>> 0; // drop the byte leaving the window\r
    const len = i - start + 1;\r
    const hitBoundary = len >= minSize && i >= WINDOW && (h & mask) === 0;\r
    if (hitBoundary || len >= maxSize) {\r
      out.push({ start, len, hash: fnv(bytes, start, len) });\r
      start = i + 1; // keep rolling h continuously — that's what makes boundaries content-local\r
    }\r
  }\r
  if (start < bytes.length) out.push({ start, len: bytes.length - start, hash: fnv(bytes, start, bytes.length - start) });\r
  return out;\r
}\r
\r
/** Dedup overlap between two chunk lists: how many of \`b\`'s chunks already exist in \`a\` (matched by hash),\r
 *  and the fraction of b's bytes that need not be stored/sent again. */\r
export function dedup(a: Chunk[], b: Chunk[]): { reused: number; total: number; bytesReused: number; bytesTotal: number } {\r
  const have = new Map<number, number>();\r
  for (const c of a) have.set(c.hash, (have.get(c.hash) ?? 0) + 1);\r
  let reused = 0, bytesReused = 0, bytesTotal = 0;\r
  const remaining = new Map(have);\r
  for (const c of b) {\r
    bytesTotal += c.len;\r
    const n = remaining.get(c.hash) ?? 0;\r
    if (n > 0) { reused++; bytesReused += c.len; remaining.set(c.hash, n - 1); }\r
  }\r
  return { reused, total: b.length, bytesReused, bytesTotal };\r
}\r
`;export{e as default};