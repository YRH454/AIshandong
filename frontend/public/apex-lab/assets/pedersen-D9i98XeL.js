var e=`// Pedersen commitments — commit to a secret value now, reveal it later, with two\r
// guarantees: HIDING (the commitment leaks nothing about the value, because a random\r
// blinding factor scrambles it) and BINDING (you can't later open it to a different value,\r
// because that would require solving a discrete log). A commitment is C = v·G + r·H, where\r
// G and H are two generators whose relative discrete log nobody knows. The magic property\r
// is that commitments are ADDITIVELY HOMOMORPHIC — C(v₁) + C(v₂) = C(v₁+v₂) — which is what\r
// lets confidential transactions prove "inputs = outputs" without revealing any amount, and\r
// underpins Bulletproofs and many zero-knowledge systems. Real toy-curve EC math (ecc.ts);\r
// the structure is exact, the security is only illustrative at this size.\r
import { CURVE, mul, add, order, type Pt } from './ecc';\r
\r
const N = order(CURVE); // 19\r
const G = CURVE.G;\r
// a second generator (in a real system H's discrete log w.r.t. G must be unknown)\r
const H: Pt = mul(7, G, CURVE).point;\r
\r
const mod = (x: number) => ((x % N) + N) % N;\r
const ptEq = (P: Pt, Q: Pt): boolean => (P === null || Q === null ? P === Q : P.x === Q.x && P.y === Q.y);\r
\r
/** C = v·G + r·H. */\r
export function commit(v: number, r: number): Pt {\r
  return add(mul(mod(v), G, CURVE).point, mul(mod(r), H, CURVE).point, CURVE);\r
}\r
\r
/** Open a commitment: does (v, r) produce C? */\r
export const open = (C: Pt, v: number, r: number): boolean => ptEq(C, commit(v, r));\r
\r
/** Homomorphic add: combining two commitments commits to the sum of the values & blindings. */\r
export const addCommit = (C1: Pt, C2: Pt): Pt => add(C1, C2, CURVE);\r
\r
export const generators = () => ({ G, H, N });\r
export const ptStr = (P: Pt): string => (P ? \`(\${P.x}, \${P.y})\` : 'O');\r
`;export{e as default};