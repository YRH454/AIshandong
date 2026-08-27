var e=`// The Fast Fourier Transform — turning a signal between the TIME domain (samples over time) and the\r
// FREQUENCY domain (how much of each frequency it contains), in O(n log n) instead of the O(n²) of the\r
// naive DFT. The Discrete Fourier Transform is X_k = Σ_n x_n·e^(−2πi·kn/N): each output bin k measures\r
// how strongly frequency k is present. Cooley-Tukey makes it fast by splitting the samples into even and\r
// odd indices, transforming each half, and combining with "twiddle factors" e^(−2πik/N) — the divide-and-\r
// conquer that recurses to length 1. It's the same butterfly structure as the NTT (which we do over a\r
// finite field instead of the complex numbers), and it underlies audio/image codecs, fast polynomial and\r
// big-integer multiplication, and signal processing everywhere. Reference: Cooley & Tukey (1965).\r
\r
export interface Complex { re: number; im: number }\r
export const cx = (re: number, im = 0): Complex => ({ re, im });\r
const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });\r
const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });\r
const mul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });\r
const expi = (t: number): Complex => ({ re: Math.cos(t), im: Math.sin(t) }); // e^(it)\r
export const mag = (c: Complex) => Math.hypot(c.re, c.im);\r
\r
/** Recursive radix-2 Cooley-Tukey FFT. \`n\` must be a power of two. */\r
export function fft(a: Complex[]): Complex[] {\r
  const n = a.length;\r
  if (n <= 1) return a.map((c) => ({ ...c }));\r
  const even = fft(a.filter((_, i) => i % 2 === 0));\r
  const odd = fft(a.filter((_, i) => i % 2 === 1));\r
  const out: Complex[] = new Array(n);\r
  for (let k = 0; k < n / 2; k++) {\r
    const t = mul(expi((-2 * Math.PI * k) / n), odd[k]); // twiddle factor × odd half\r
    out[k] = add(even[k], t);\r
    out[k + n / 2] = sub(even[k], t);\r
  }\r
  return out;\r
}\r
\r
/** Inverse FFT: conjugate, forward-transform, conjugate, and scale by 1/n. */\r
export function ifft(A: Complex[]): Complex[] {\r
  const n = A.length;\r
  const conj = A.map((c) => ({ re: c.re, im: -c.im }));\r
  const y = fft(conj);\r
  return y.map((c) => ({ re: c.re / n, im: -c.im / n }));\r
}\r
\r
/** Build a length-n real signal by summing cosine components {freq, amp}. */\r
export function signalFrom(n: number, comps: { freq: number; amp: number }[]): Complex[] {\r
  return Array.from({ length: n }, (_, t) => cx(comps.reduce((s, c) => s + c.amp * Math.cos((2 * Math.PI * c.freq * t) / n), 0)));\r
}\r
`;export{e as default};