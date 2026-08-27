var e=`// Diffie–Hellman key exchange — two parties agree on a shared secret over a\r
// public channel, and an eavesdropper who sees everything still can't compute it.\r
// Security rests on the discrete-log problem: g^a mod p is easy, recovering a is\r
// not. Real deployments use 2048-bit+ MODP groups (RFC 3526); the small numbers\r
// here are for seeing the mechanism. Pure BigInt math, tested on known examples.\r
\r
/** Modular exponentiation: base^exp mod m, via square-and-multiply. */\r
export function modpow(base: bigint, exp: bigint, m: bigint): bigint {\r
  if (m === 1n) return 0n;\r
  let result = 1n;\r
  base %= m;\r
  while (exp > 0n) {\r
    if (exp & 1n) result = (result * base) % m;\r
    exp >>= 1n;\r
    base = (base * base) % m;\r
  }\r
  return result;\r
}\r
\r
export interface DhResult {\r
  p: bigint; g: bigint;\r
  a: bigint; b: bigint; // private exponents\r
  A: bigint; B: bigint; // public values g^a, g^b\r
  sharedAlice: bigint; // B^a mod p\r
  sharedBob: bigint; // A^b mod p\r
  agree: boolean;\r
}\r
\r
/** Run a full DH exchange for given parameters and private exponents. */\r
export function dhExchange(p: bigint, g: bigint, a: bigint, b: bigint): DhResult {\r
  const A = modpow(g, a, p);\r
  const B = modpow(g, b, p);\r
  const sharedAlice = modpow(B, a, p);\r
  const sharedBob = modpow(A, b, p);\r
  return { p, g, a, b, A, B, sharedAlice, sharedBob, agree: sharedAlice === sharedBob };\r
}\r
\r
/** Recover a private exponent from its public value by brute force — the discrete log.\r
 *  Trivial for a tiny demo prime, infeasible for real 2048-bit / 256-bit-curve groups;\r
 *  this is exactly the work that keeps the shared secret secret. */\r
export function dhBruteForce(p: bigint, g: bigint, pub: bigint): { priv: bigint | null; tries: number } {\r
  let acc = 1n;\r
  for (let x = 1n; x < p; x++) {\r
    acc = (acc * g) % p; // acc = g^x mod p\r
    if (acc === pub) return { priv: x, tries: Number(x) };\r
  }\r
  return { priv: null, tries: Number(p) - 1 };\r
}\r
`;export{e as default};