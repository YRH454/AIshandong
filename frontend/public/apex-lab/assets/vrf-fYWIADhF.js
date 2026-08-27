var e=`// Verifiable Random Function (VRF) — a keyed hash that is unpredictable to everyone except the key\r
// holder, yet whose output anyone can VERIFY is correct. Feed an input x; the secret key produces a\r
// pseudorandom output β plus a proof π. With the public key, anyone checks that β really is the unique\r
// VRF output for x — but without the secret key nobody could have predicted β, and the holder can't\r
// "shop" for a favorable one (there's exactly one valid β per x). That combination — unpredictable but\r
// non-manipulable and publicly checkable — is what makes VRFs the engine of leaderless lotteries:\r
// blockchain leader/committee election (Algorand, Cardano's Ouroboros), DNSSEC NSEC5, and randomness\r
// beacons. Here we build the RSA-FDH-style VRF on the project's toy RSA. Reference: Micali, Rabin &\r
// Vadhan (1999); IRTF draft-irtf-cfrg-vrf.\r
\r
import { N, E, D, modpow } from './blindsig';\r
\r
const fnv = (s: string): number => { let h = 0x811c9dc5 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };\r
/** Hash the input into the RSA group [1, n-1] (avoid 0, which is degenerate under exponentiation). */\r
export const hashToGroup = (x: string): number => 1 + (fnv('vrf|' + x) % (N - 1));\r
/** Derive the public output from the proof — a deterministic 0–999 "random" value. */\r
export const proofToOutput = (proof: number): number => fnv('out|' + proof) % 1000;\r
\r
export interface Vrf { input: string; hashed: number; proof: number; output: number }\r
\r
/** Prove: π = H(x)^d mod n (only the secret key can compute it); β = H'(π). */\r
export function prove(input: string): Vrf {\r
  const hashed = hashToGroup(input);\r
  const proof = modpow(hashed, D, N);\r
  return { input, hashed, proof, output: proofToOutput(proof) };\r
}\r
\r
/** Verify with the public key: π^e mod n must equal H(x), and β must equal H'(π). */\r
export function verify(input: string, output: number, proof: number): boolean {\r
  return modpow(proof, E, N) === hashToGroup(input) && output === proofToOutput(proof);\r
}\r
`;export{e as default};