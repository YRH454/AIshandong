var e=`// Threshold signatures (t-of-n Schnorr, the idea behind FROST) — a signing key that no single party\r
// ever holds, yet ANY t of n parties can jointly produce ONE ordinary signature, while t−1 cannot.\r
// The group secret x is Shamir-shared: x = f(0) of a degree-(t−1) polynomial, party i holds s_i = f(i),\r
// and the group public key is Y = x·G. To sign, a coalition S of t parties each picks a nonce d_i and\r
// publishes R_i = d_i·G; the aggregate nonce is R = Σ R_i and the challenge c = H(R, Y, m). Each party\r
// returns a PARTIAL signature z_i = d_i + c·λ_i·s_i, where λ_i is its Lagrange coefficient at 0 for the\r
// set S. The combiner sums them: z = Σ z_i. The magic is Σ λ_i·s_i = f(0) = x (Lagrange interpolation),\r
// so z = (Σ d_i) + c·x and therefore z·G = R + c·Y — a valid Schnorr signature, with x NEVER assembled.\r
// A coalition of only t−1 interpolates to the WRONG value (≠ x), so the signature fails to verify.\r
// Real EC math on the project's verified toy curve (group order 19); the hash is a teaching stand-in.\r
import { CURVE, mul, add, modinv, type Pt } from './ecc';\r
\r
export const N = 19; // the curve's prime group order — scalars live in F_19\r
const G = CURVE.G;\r
const smod = (a: number): number => ((a % N) + N) % N;\r
const ptEq = (P: Pt, Q: Pt): boolean => (P === null || Q === null) ? P === Q : P.x === Q.x && P.y === Q.y;\r
\r
/** k·P (default P = the generator G), scalar reduced mod the group order. */\r
export const scalarMul = (k: number, P: Pt = G): Pt => mul(smod(k), P, CURVE).point;\r
\r
// ---- Shamir sharing over F_19 (the scalar field) -----------------------------------------------\r
\r
export const evalPoly = (coeffs: number[], x: number): number => {\r
  let acc = 0, xp = 1;\r
  for (const c of coeffs) { acc = smod(acc + c * xp); xp = smod(xp * x); }\r
  return acc;\r
};\r
\r
export interface Share { id: number; value: number }\r
export interface Dealt { shares: Share[]; pub: Pt; coeffs: number[] }\r
\r
/** Deal a t-of-n sharing of \`secret\`: f(0)=secret, degree t−1; share i = f(i); group key Y = secret·G. */\r
export function deal(secret: number, t: number, n: number, randomCoeffs: number[]): Dealt {\r
  const coeffs = [smod(secret), ...Array.from({ length: t - 1 }, (_, i) => smod(randomCoeffs[i] ?? 1))];\r
  const shares = Array.from({ length: n }, (_, i) => ({ id: i + 1, value: evalPoly(coeffs, i + 1) }));\r
  return { shares, pub: scalarMul(secret), coeffs };\r
}\r
\r
/** Lagrange basis coefficient at x=0 for member \`id\` within coalition \`S\` (in F_19). */\r
export function lagrange0(S: number[], id: number): number {\r
  let num = 1, den = 1;\r
  for (const j of S) if (j !== id) { num = smod(num * smod(-j)); den = smod(den * smod(id - j)); }\r
  return smod(num * modinv(den, N));\r
}\r
\r
/** Reconstruct the secret from a set of shares via Lagrange at 0 (the sanity check that Σλ·s = x). */\r
export const reconstruct = (shares: Share[]): number => {\r
  const ids = shares.map((s) => s.id);\r
  return smod(shares.reduce((acc, s) => smod(acc + smod(lagrange0(ids, s.id) * s.value)), 0));\r
};\r
\r
// ---- threshold Schnorr signing -----------------------------------------------------------------\r
\r
/** A deterministic teaching challenge c = H(R, Y, m) ∈ [1, N−1]. */\r
export function challenge(R: Pt, Y: Pt, msg: string): number {\r
  let h = 0x811c9dc5 >>> 0;\r
  const s = \`\${R ? R.x + ',' + R.y : 'O'}|\${Y ? Y.x + ',' + Y.y : 'O'}|\${msg}\`;\r
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }\r
  return 1 + (h % (N - 1)); // never 0, so the c·Y term never degenerates\r
}\r
\r
export interface Signature { R: Pt; z: number; c: number }\r
\r
/** A coalition (its shares) each contributes a nonce; produce the combined (R, z) signature. */\r
export function sign(coalition: Share[], nonces: number[], pub: Pt, msg: string): Signature {\r
  const ids = coalition.map((s) => s.id);\r
  const R = coalition.reduce<Pt>((acc, _, i) => add(acc, scalarMul(nonces[i]), CURVE), null);\r
  const c = challenge(R, pub, msg);\r
  const z = smod(coalition.reduce((acc, s, i) => smod(acc + smod(nonces[i] + smod(c * smod(lagrange0(ids, s.id) * s.value)))), 0));\r
  return { R, z, c };\r
}\r
\r
/** Verify a Schnorr signature against the group public key: z·G == R + c·Y. */\r
export function verify(sig: Signature, pub: Pt, msg: string): boolean {\r
  if (challenge(sig.R, pub, msg) !== sig.c) return false;\r
  const lhs = scalarMul(sig.z); //            z·G\r
  const rhs = add(sig.R, scalarMul(sig.c, pub), CURVE); // R + c·Y\r
  return ptEq(lhs, rhs);\r
}\r
`;export{e as default};