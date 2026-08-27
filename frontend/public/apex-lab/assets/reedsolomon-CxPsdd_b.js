var e=`// Reed-Solomon erasure coding over GF(256) — the real field (Rijndael's, poly 0x11b) used\r
// by QR codes, CDs/DVDs, and RAID-6. Treat k data bytes as the values of a degree-(k-1)\r
// polynomial at k points; evaluating that polynomial at n > k points gives a codeword with\r
// n-k redundant symbols. Lose ANY n-k symbols and the remaining k points still pin down the\r
// same polynomial (Lagrange interpolation), so every byte is recoverable. This encoder is\r
// systematic — the first k codeword symbols ARE the data — and the math is genuine GF(256),\r
// not a prime-field stand-in. Pure and tested (GF products vs FIPS-197 + full recovery).\r
\r
// ── GF(256) arithmetic via exp/log tables, generator 3, reduction poly 0x11b ──\r
const EXP = new Uint8Array(512);\r
const LOG = new Uint8Array(256);\r
function mulNoTable(a: number, b: number): number {\r
  let p = 0;\r
  for (let i = 0; i < 8; i++) {\r
    if (b & 1) p ^= a;\r
    const hi = a & 0x80;\r
    a = (a << 1) & 0xff;\r
    if (hi) a ^= 0x1b;\r
    b >>= 1;\r
  }\r
  return p;\r
}\r
(() => {\r
  let v = 1;\r
  for (let i = 0; i < 255; i++) { EXP[i] = v; LOG[v] = i; v = mulNoTable(v, 3); }\r
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];\r
})();\r
\r
export const gmul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);\r
// precondition: b ≠ 0 (denominators here are differences of DISTINCT interpolation x-coords, never zero)\r
export const gdiv = (a: number, b: number): number => (a === 0 ? 0 : EXP[(LOG[a] - LOG[b] + 255) % 255]);\r
const gsub = (a: number, b: number) => a ^ b; // subtraction == addition == XOR in GF(2^n)\r
\r
/** Lagrange-interpolate the polynomial through \`points\` and evaluate it at \`atX\`. */\r
export function interpolateEval(points: [number, number][], atX: number): number {\r
  let acc = 0;\r
  for (let i = 0; i < points.length; i++) {\r
    const [xi, yi] = points[i];\r
    let num = 1, den = 1;\r
    for (let j = 0; j < points.length; j++) {\r
      if (j === i) continue;\r
      num = gmul(num, gsub(atX, points[j][0]));\r
      den = gmul(den, gsub(xi, points[j][0]));\r
    }\r
    acc = gsub(acc, gmul(yi, gdiv(num, den)));\r
  }\r
  return acc;\r
}\r
\r
/** Encode k data bytes into an n-symbol systematic codeword (points x = 1..n). */\r
export function encode(data: number[], n: number): number[] {\r
  const k = data.length;\r
  const known: [number, number][] = data.map((y, i) => [i + 1, y]);\r
  const out: number[] = [];\r
  for (let j = 0; j < n; j++) out.push(j < k ? data[j] : interpolateEval(known, j + 1));\r
  return out;\r
}\r
\r
/** Recover the k data bytes from a received codeword with erasures (null = lost).\r
 *  Returns null if fewer than k symbols survive. */\r
export function decode(received: (number | null)[], k: number): number[] | null {\r
  const survivors: [number, number][] = [];\r
  received.forEach((v, idx) => { if (v !== null) survivors.push([idx + 1, v]); });\r
  if (survivors.length < k) return null; // too many erasures\r
  const pts = survivors.slice(0, k);\r
  return Array.from({ length: k }, (_, i) => interpolateEval(pts, i + 1));\r
}\r
`;export{e as default};