var e=`// The man-in-the-middle on unauthenticated Diffie–Hellman. DH lets two strangers\r
// derive a shared secret over an open wire, and a PASSIVE eavesdropper can't recover\r
// it (discrete log is hard). But an ACTIVE attacker who can rewrite traffic just runs\r
// DH twice — once with each side — and sits in the middle decrypting and re-encrypting.\r
// Neither side notices, because nothing tied the DH public value to an identity. The\r
// fix is authentication: sign the public value, and Eve's substitution fails the\r
// check. Real modular arithmetic (modpow from rsa.ts); canonical p=23, g=5.\r
import { modpow } from './rsa';\r
\r
export const P = 23n;\r
export const G = 5n;\r
\r
export const pub = (priv: number): number => Number(modpow(G, BigInt(priv), P));\r
export const shared = (otherPub: number, priv: number): number => Number(modpow(BigInt(otherPub), BigInt(priv), P));\r
\r
export interface DhResult {\r
  A: number; B: number; // the genuine public values\r
  aliceSees: number; bobSees: number; // the public value each side actually receives\r
  aliceKey: number; bobKey: number; // the secret each side derives\r
  eve?: { pub: number; keyWithAlice: number; keyWithBob: number };\r
  agree: boolean; // do Alice and Bob hold the same key?\r
  compromised: boolean; // is Eve silently in the middle?\r
  detected: boolean; // did authentication catch the substitution?\r
}\r
\r
export interface Opts { mitm: boolean; eve: number; authenticated: boolean }\r
\r
export function exchange(a: number, b: number, opts: Opts): DhResult {\r
  const A = pub(a), B = pub(b);\r
  if (!opts.mitm) {\r
    const aliceKey = shared(B, a), bobKey = shared(A, b);\r
    return { A, B, aliceSees: B, bobSees: A, aliceKey, bobKey, agree: aliceKey === bobKey, compromised: false, detected: false };\r
  }\r
  // Active Eve substitutes her own public value toward each side.\r
  const E = pub(opts.eve);\r
  const aliceKey = shared(E, a); // Alice ↔ Eve\r
  const bobKey = shared(E, b); // Bob ↔ Eve\r
  const eve = { pub: E, keyWithAlice: shared(A, opts.eve), keyWithBob: shared(B, opts.eve) };\r
  if (opts.authenticated) {\r
    // The signed public value won't match Eve's substitution → handshake aborts.\r
    return { A, B, aliceSees: B, bobSees: A, aliceKey: shared(B, a), bobKey: shared(A, b), eve, agree: true, compromised: false, detected: true };\r
  }\r
  return { A, B, aliceSees: E, bobSees: E, aliceKey, bobKey, eve, agree: aliceKey === bobKey, compromised: true, detected: false };\r
}\r
`;export{e as default};