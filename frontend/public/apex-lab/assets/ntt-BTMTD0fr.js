var e=`// The Number-Theoretic Transform (NTT) — the FFT done in a finite field, and the engine that makes\r
// lattice cryptography (Kyber/ML-KEM, Dilithium) fast. Multiplying two degree-(n−1) polynomials the\r
// schoolbook way is O(n²); the NTT maps each polynomial to the "evaluation domain" where multiplication\r
// becomes a single POINTWISE product, then maps back — O(n log n) with the fast butterfly. Lattice\r
// schemes work in the ring Z_q[x]/(x^n+1), so we use the NEGACYCLIC variant: a ψ-weighting (ψ a primitive\r
// 2n-th root of unity, ψ^n = −1) folds the x^n = −1 wrap into an ordinary length-n NTT with ω = ψ².\r
// We implement the direct O(n²) definition (legible, exact for the toy n=8, q=17); the identity\r
// INTT(NTT(a)∘NTT(b)) = a·b mod (x^n+1) is what the tests anchor to. Reference: FIPS 203 (ML-KEM) §4.3.\r
\r
export const mod = (a: number, q: number) => ((a % q) + q) % q;\r
export function modpow(b: number, e: number, q: number): number {\r
  let r = 1; b = mod(b, q);\r
  while (e > 0) { if (e & 1) r = mod(r * b, q); b = mod(b * b, q); e >>= 1; }\r
  return r;\r
}\r
export const modinv = (a: number, q: number) => modpow(a, q - 2, q); // q prime\r
\r
/** Forward negacyclic NTT: ψ-weight, then evaluate at powers of ω = ψ². Returns the n transform values. */\r
export function ntt(a: number[], q: number, psi: number): number[] {\r
  const n = a.length;\r
  const omega = mod(psi * psi, q);\r
  const weighted = a.map((x, j) => mod(x * modpow(psi, j, q), q));\r
  const out: number[] = [];\r
  for (let i = 0; i < n; i++) {\r
    let acc = 0;\r
    for (let j = 0; j < n; j++) acc = mod(acc + weighted[j] * modpow(omega, i * j, q), q);\r
    out.push(acc);\r
  }\r
  return out;\r
}\r
\r
/** Inverse negacyclic NTT: interpolate with ω⁻¹, scale by n⁻¹, then strip the ψ-weighting. */\r
export function intt(ahat: number[], q: number, psi: number): number[] {\r
  const n = ahat.length;\r
  const ominv = modinv(mod(psi * psi, q), q);\r
  const ninv = modinv(n, q);\r
  const psinv = modinv(psi, q);\r
  const out: number[] = [];\r
  for (let j = 0; j < n; j++) {\r
    let acc = 0;\r
    for (let i = 0; i < n; i++) acc = mod(acc + ahat[i] * modpow(ominv, i * j, q), q);\r
    out.push(mod(mod(acc * ninv, q) * modpow(psinv, j, q), q));\r
  }\r
  return out;\r
}\r
\r
/** Element-wise product in the transform domain — this is the whole point of the NTT. */\r
export const pointwise = (a: number[], b: number[], q: number) => a.map((x, i) => mod(x * b[i], q));\r
\r
/** Schoolbook negacyclic convolution: c = a·b mod (x^n+1) — terms that wrap past x^n flip sign. */\r
export function negamul(a: number[], b: number[], q: number): number[] {\r
  const n = a.length;\r
  const c = new Array(n).fill(0);\r
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {\r
    const k = i + j;\r
    if (k < n) c[k] = mod(c[k] + a[i] * b[j], q);\r
    else c[k - n] = mod(c[k - n] - a[i] * b[j], q); // x^n ≡ −1\r
  }\r
  return c;\r
}\r
\r
/** Multiply via the NTT path: transform both, multiply pointwise, transform back. */\r
export const nttMul = (a: number[], b: number[], q: number, psi: number) =>\r
  intt(pointwise(ntt(a, q, psi), ntt(b, q, psi), q), q, psi);\r
\r
// Default toy parameters: n=8, q=17, ψ=3 (a primitive 16th root of unity mod 17, ψ^8 ≡ −1, ω=ψ²=9).\r
export const TOY = { n: 8, q: 17, psi: 3 };\r
`;export{e as default};