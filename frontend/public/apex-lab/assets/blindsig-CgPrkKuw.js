var e=`// RSA blind signatures — getting a valid signature on a message the signer never sees. The client\r
// multiplies its message m by r^e (a random "blinding factor" r raised to the public exponent), so the\r
// signer sees only the uniformly-random product and learns nothing about m. The signer raises that to\r
// its private exponent d as usual; the client then divides out r and is left with m^d mod n — an\r
// ordinary RSA signature on m — because (m·r^e)^d · r^{-1} = m^d · r^{ed-1} = m^d (since r^ed = r).\r
// Anyone can verify it against the public key like any signature, yet the signer can't link it back to\r
// the signing session. This is the engine of Chaum's digital cash (the bank signs a coin it can't trace),\r
// Privacy Pass / anonymous tokens, and e-voting. Reference: Chaum, "Blind Signatures for Untraceable\r
// Payments" (1982). (Toy RSA modulus so the numbers are legible; the construction is the real one.)\r
\r
// classic textbook RSA: n = 61·53 = 3233, e = 17, d = 2753.\r
export const N = 3233, E = 17, D = 2753;\r
\r
export function modpow(base: number, exp: number, mod: number): number {\r
  let r = 1; base %= mod;\r
  while (exp > 0) { if (exp & 1) r = (r * base) % mod; base = (base * base) % mod; exp >>= 1; }\r
  return r;\r
}\r
/** Modular inverse via the extended Euclidean algorithm. */\r
export function modinv(a: number, mod: number): number {\r
  let [old_r, r] = [((a % mod) + mod) % mod, mod];\r
  let [old_s, s] = [1, 0];\r
  while (r !== 0) { const q = Math.floor(old_r / r); [old_r, r] = [r, old_r - q * r]; [old_s, s] = [s, old_s - q * s]; }\r
  return ((old_s % mod) + mod) % mod;\r
}\r
\r
/** What the signer SEES: m blinded by r — m · r^e mod n. Reveals nothing about m. */\r
export const blind = (m: number, r: number) => (m * modpow(r, E, N)) % N;\r
/** The signer signs the blinded value (blindly): blinded^d mod n. */\r
export const signBlinded = (blinded: number) => modpow(blinded, D, N);\r
/** The client removes the blinding: s' · r^{-1} mod n = m^d mod n. */\r
export const unblind = (sPrime: number, r: number) => (sPrime * modinv(r, N)) % N;\r
/** Verify an RSA signature: s^e mod n == m. */\r
export const verify = (s: number, m: number) => modpow(s, E, N) === m % N;\r
/** Signing m directly (the non-blind reference) — the blind path must yield the identical signature. */\r
export const signDirect = (m: number) => modpow(m, D, N);\r
`;export{e as default};