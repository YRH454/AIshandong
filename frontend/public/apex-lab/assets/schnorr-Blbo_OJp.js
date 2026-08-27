var e=`// Schnorr's zero-knowledge proof of knowledge — prove you know a secret x (the\r
// discrete log of a public Y = xG) WITHOUT revealing x. Three moves: the prover\r
// commits T = rG to a random r; the verifier sends a random challenge c; the prover\r
// answers s = r + c·x. The check g^s = T·Y^c holds iff the prover knew x, yet the\r
// transcript (T, c, s) could be simulated for any verifier, so it leaks nothing. This\r
// is the heart of Schnorr/EdDSA signatures (Fiat–Shamir sets c = H(...) to drop the\r
// interaction). Built on the ecc.ts toy curve (order 19). Tested.\r
import { CURVE, mul, add, order, type Pt } from './ecc';\r
\r
export const N = order(CURVE); // scalar field = subgroup order\r
const m = (n: number) => ((n % N) + N) % N;\r
const G = CURVE.G;\r
const ptEq = (a: Pt, b: Pt) => (a === null ? b === null : b !== null && a.x === b.x && a.y === b.y);\r
\r
export const publicKey = (x: number): Pt => mul(m(x), G, CURVE).point; // Y = xG\r
export const commit = (r: number): Pt => mul(m(r), G, CURVE).point; // T = rG\r
export const respond = (r: number, c: number, x: number): number => m(r + c * x); // s = r + c·x mod N\r
\r
/** Verify: sG == T + cY. */\r
export function verify(Y: Pt, T: Pt, c: number, s: number): boolean {\r
  const lhs = mul(m(s), G, CURVE).point;\r
  const rhs = add(T, mul(m(c), Y, CURVE).point, CURVE);\r
  return ptEq(lhs, rhs);\r
}\r
\r
/** A cheating prover who picks the response s and challenge c FIRST can back out a\r
 *  matching commitment T = sG − cY — which is exactly why the verifier must choose c\r
 *  AFTER seeing T (and why simulatability ⇒ zero-knowledge). */\r
export function forgeCommit(Y: Pt, c: number, s: number): Pt {\r
  const sG = mul(m(s), G, CURVE).point;\r
  const cY = mul(m(c), Y, CURVE).point;\r
  // T = sG − cY = sG + (−cY): negate cY's y-coordinate\r
  const negcY: Pt = cY === null ? null : { x: cY.x, y: (CURVE.p - cY.y) % CURVE.p };\r
  return add(sG, negcY, CURVE);\r
}\r
`;export{e as default};