var e=`// ECDSA on the same toy curve as the ECC section — signing, verifying, and the\r
// catastrophe that has burned real systems: reuse the per-signature nonce k and\r
// the private key falls out of two signatures by simple algebra. This is exactly\r
// how the Sony PS3 firmware key (2010) and a string of Bitcoin wallets were\r
// stolen. The scalar field is the curve order n = 19; arithmetic is real.\r
import { CURVE, mul, add, order, modinv, type Point } from './ecc';\r
\r
const N = order(CURVE); // the subgroup order; signatures live mod N\r
const m = (n: number) => ((n % N) + N) % N;\r
\r
export interface Sig { r: number; s: number }\r
\r
/** Sign hash z with private key d using nonce k (caller supplies k so the demo\r
 *  can deliberately reuse it). r = (kG).x mod N; s = k^{-1}(z + r·d) mod N. */\r
export function ecdsaSign(z: number, d: number, k: number): Sig {\r
  const R = mul(m(k), CURVE.G, CURVE).point as Point;\r
  const r = m(R.x);\r
  const s = m(modinv(m(k), N) * (m(z) + r * d));\r
  return { r, s };\r
}\r
\r
/** Verify: P = (z·s^{-1})G + (r·s^{-1})Q ; valid iff P.x mod N == r. */\r
export function ecdsaVerify(z: number, sig: Sig, Q: Point): boolean {\r
  const { r, s } = sig;\r
  if (r <= 0 || r >= N || s <= 0 || s >= N) return false;\r
  const w = modinv(s, N);\r
  const u1 = m(z * w), u2 = m(r * w);\r
  const P = add(mul(u1, CURVE.G, CURVE).point, mul(u2, Q, CURVE).point, CURVE);\r
  if (P === null) return false;\r
  return m(P.x) === r;\r
}\r
\r
export const publicKey = (d: number): Point => mul(m(d), CURVE.G, CURVE).point as Point;\r
\r
export interface Recovered { k: number; d: number }\r
\r
/** Two signatures that reused the same nonce k (so they share r) leak everything:\r
 *  k = (z1 − z2)/(s1 − s2),  then  d = (s·k − z)/r — all mod N. */\r
export function recoverFromReuse(z1: number, s1: number, z2: number, s2: number, r: number): Recovered {\r
  const k = m((z1 - z2) * modinv(m(s1 - s2), N));\r
  const d = m((s1 * k - z1) * modinv(r, N));\r
  return { k, d };\r
}\r
\r
export const curveOrder = N;\r
`;export{e as default};