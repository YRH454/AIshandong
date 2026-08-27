var e=`// EdDSA (the Ed25519 construction, on Apex's toy curve). A Schnorr-style signature with\r
// one decisive twist: the per-signature nonce is DERIVED DETERMINISTICALLY from the\r
// secret key and the message, r = H(secret ‖ message), instead of being randomly drawn.\r
// That single change kills the catastrophe that breaks ECDSA — reuse the same nonce on\r
// two different messages and anyone can solve for your private key (see the ECDSA\r
// section). With EdDSA each message gets its own nonce by construction, so reuse across\r
// distinct messages can't happen, and there's no RNG to get wrong. Real toy-curve EC math\r
// (ecc.ts) + real SHA-256 (sha256.ts); tested.\r
import { CURVE, mul, add, order, type Pt } from './ecc';\r
import { sha256 } from './sha256';\r
\r
const N = order(CURVE); // 19 — the generator's order\r
const G = CURVE.G;\r
\r
const ptEq = (P: Pt, Q: Pt): boolean => (P === null || Q === null ? P === Q : P.x === Q.x && P.y === Q.y);\r
\r
/** Hash a label + numbers to a scalar via real SHA-256, reduced into the given range. */\r
function hashScalar(parts: (number | string)[], lo: number, hi: number): number {\r
  const bytes = new TextEncoder().encode(parts.join('|'));\r
  const d = sha256(bytes);\r
  const v = ((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0;\r
  return lo + (v % (hi - lo));\r
}\r
\r
export const publicKey = (secret: number): Pt => mul(secret, G, CURVE).point;\r
\r
/** Deterministic nonce in 1..N-1 from the secret and message — never random. */\r
export const nonce = (secret: number, msg: number): number => hashScalar(['nonce', secret, msg], 1, N);\r
\r
const challenge = (R: Pt, A: Pt, msg: number): number =>\r
  hashScalar(['chal', R ? R.x : -1, R ? R.y : -1, A ? A.x : -1, A ? A.y : -1, msg], 0, N);\r
\r
export interface Signature { R: Pt; s: number; r: number; e: number }\r
\r
export function sign(secret: number, msg: number): Signature {\r
  const A = publicKey(secret);\r
  const r = nonce(secret, msg);\r
  const R = mul(r, G, CURVE).point;\r
  const e = challenge(R, A, msg);\r
  const s = (r + e * secret) % N;\r
  return { R, s, r, e };\r
}\r
\r
/** Verify s·G == R + e·A. */\r
export function verify(A: Pt, msg: number, sig: { R: Pt; s: number }): boolean {\r
  const e = challenge(sig.R, A, msg);\r
  const lhs = mul(sig.s, G, CURVE).point;\r
  const rhs = add(sig.R, mul(e, A, CURVE).point, CURVE);\r
  return ptEq(lhs, rhs);\r
}\r
`;export{e as default};