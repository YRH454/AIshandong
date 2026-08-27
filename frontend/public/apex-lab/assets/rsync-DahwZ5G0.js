var e=`// The rsync algorithm — how you sync a changed file to a remote copy by sending only the DIFFERENCES, without\r
// either side knowing in advance what changed, and without transferring the whole file to compare. It's the\r
// engine of \`rsync\`, of backup tools, and of how Dropbox-style sync avoids re-uploading a 2 GB file because you\r
// edited one line. The clever part is that the two machines never see each other's data up front. The RECEIVER\r
// (which holds the OLD file) chops it into fixed-size blocks and, for each, computes two checksums: a cheap\r
// ROLLING (weak) one and an expensive STRONG one, and ships just that little table of checksums to the sender.\r
// The SENDER (which holds the NEW file) then slides a block-sized window one byte at a time across its file,\r
// updating the rolling checksum in O(1) per step (that's the whole trick — the weak checksum can be updated by\r
// subtracting the byte leaving the window and adding the byte entering it, à la Rabin/Adler). Whenever the\r
// rolling value matches one in the table, it confirms with the strong checksum, and on a real match emits\r
// "copy block N from the file you already have" and jumps the window forward a full block; otherwise it emits\r
// the single literal byte and rolls on. The result is a compact stream of COPY references and literal runs that\r
// the receiver replays against its old file to rebuild the new one exactly — moving only the bytes that are\r
// genuinely new, even when edits shift everything downstream. This models the checksums, the rolling window,\r
// and the delta. Reference: Tridgell & Mackerras, "The rsync algorithm" (1996).\r
\r
const M = 65536;\r
export type Op = { type: 'copy'; block: number } | { type: 'literal'; data: string };\r
\r
/** Weak rolling checksum of s[start .. start+len) computed from scratch (the rsync a/b construction). */\r
export function weak(s: string, start: number, len: number): number {\r
  let a = 0, b = 0;\r
  for (let k = 0; k < len; k++) { const x = s.charCodeAt(start + k); a = (a + x) % M; b = (b + (len - k) * x) % M; }\r
  return (a + M * b) >>> 0;\r
}\r
\r
/** Strong checksum (a stand-in for MD5/xxHash) to confirm a weak match isn't a collision. */\r
export function strong(s: string, start: number, len: number): number {\r
  let h = 2166136261 >>> 0;\r
  for (let k = 0; k < len; k++) { h ^= s.charCodeAt(start + k); h = Math.imul(h, 16777619) >>> 0; }\r
  return h >>> 0;\r
}\r
\r
/** The receiver's block-checksum table: weak → list of {block index, strong}. */\r
export function blockTable(old: string, B: number): Map<number, { j: number; st: number }[]> {\r
  const table = new Map<number, { j: number; st: number }[]>();\r
  const n = Math.floor(old.length / B);\r
  for (let j = 0; j < n; j++) {\r
    const w = weak(old, j * B, B);\r
    (table.get(w) ?? table.set(w, []).get(w)!).push({ j, st: strong(old, j * B, B) });\r
  }\r
  return table;\r
}\r
\r
/** Sender: slide over \`next\`, matching blocks of \`old\` via the rolling checksum, and emit the delta. */\r
export function computeDelta(old: string, next: string, B: number): Op[] {\r
  const table = blockTable(old, B);\r
  const delta: Op[] = [];\r
  let lit = '';\r
  let i = 0, a = 0, b = 0;\r
  const s = () => (a + M * b) >>> 0;\r
  const recompute = (pos: number) => { a = 0; b = 0; for (let k = 0; k < B; k++) { const x = next.charCodeAt(pos + k); a = (a + x) % M; b = (b + (B - k) * x) % M; } };\r
  if (next.length >= B) recompute(0);\r
\r
  while (i < next.length) {\r
    if (i + B <= next.length) {\r
      const cands = table.get(s());\r
      const hit = cands ? cands.find((c) => c.st === strong(next, i, B)) : undefined;\r
      if (hit) {\r
        if (lit) { delta.push({ type: 'literal', data: lit }); lit = ''; }\r
        delta.push({ type: 'copy', block: hit.j });\r
        i += B;\r
        if (i + B <= next.length) recompute(i);\r
      } else {\r
        const out = next.charCodeAt(i);\r
        lit += next[i];\r
        if (i + B < next.length) { // roll the window one byte forward\r
          const inp = next.charCodeAt(i + B);\r
          a = ((a - out + inp) % M + M) % M;\r
          b = ((b - B * out + a) % M + M) % M;\r
        }\r
        i++;\r
      }\r
    } else { lit += next[i]; i++; }\r
  }\r
  if (lit) delta.push({ type: 'literal', data: lit });\r
  return delta;\r
}\r
\r
/** Receiver: replay the delta against the old file to rebuild the new one. */\r
export function reconstruct(old: string, delta: Op[], B: number): string {\r
  let out = '';\r
  for (const op of delta) out += op.type === 'copy' ? old.slice(op.block * B, op.block * B + B) : op.data;\r
  return out;\r
}\r
\r
/** Bytes actually transferred: literal bytes + a few bytes per copy reference (vs the whole new file). */\r
export function transferred(delta: Op[], copyRefBytes = 4): number {\r
  return delta.reduce((n, op) => n + (op.type === 'literal' ? op.data.length : copyRefBytes), 0);\r
}\r
`;export{e as default};