var e=`// ElGamal encryption — a public-key scheme built directly on the Diffie–Hellman idea, and the ancestor of DSA\r
// and of homomorphic e-voting. Where RSA hides a message inside a modular power, ElGamal hides it by MULTIPLYING\r
// it with a fresh Diffie–Hellman shared secret that only the private-key holder can reconstruct. Setup: a large\r
// prime p and a generator g are public; the private key is a random x, and the public key is y = g^x mod p.\r
// To encrypt a message m (a group element), the sender picks a fresh random k, computes an ephemeral public\r
// value c1 = g^k, derives the shared secret s = y^k = g^(xk), and sends (c1, c2) where c2 = m·s. The receiver\r
// recomputes the same secret from their private key — s = c1^x = g^(kx) — and divides it out: m = c2·s⁻¹. Two\r
// properties fall out and matter enormously. First, encryption is RANDOMIZED: the same message under the same\r
// key gives a totally different ciphertext every time (because k is fresh), so it's semantically secure — you\r
// can't even tell if two ciphertexts encrypt the same thing. Second, it's MULTIPLICATIVELY HOMOMORPHIC:\r
// multiply two ciphertexts componentwise and you get an encryption of the product of the plaintexts, without\r
// ever decrypting — the basis for tallying encrypted votes. This models keygen, encrypt, decrypt, and the\r
// homomorphism with real modular arithmetic (small primes so the numbers are legible). Reference: ElGamal, "A\r
// Public Key Cryptosystem…" (IEEE IT, 1985).\r
\r
/** modular exponentiation: base^exp mod m (square-and-multiply). */\r
export function modpow(base: number, exp: number, m: number): number {\r
  base %= m; let r = 1;\r
  while (exp > 0) { if (exp & 1) r = (r * base) % m; base = (base * base) % m; exp = Math.floor(exp / 2); }\r
  return r;\r
}\r
\r
/** modular inverse mod a prime p, via Fermat's little theorem: a^(p-2) mod p. */\r
export const modinv = (a: number, p: number): number => modpow(((a % p) + p) % p, p - 2, p);\r
\r
export interface PublicKey { p: number; g: number; y: number }\r
export interface Ciphertext { c1: number; c2: number }\r
\r
/** Derive the public key y = g^x mod p from the private key x. */\r
export function keygen(p: number, g: number, x: number): PublicKey {\r
  return { p, g, y: modpow(g, x, p) };\r
}\r
\r
/** Encrypt m in [1, p-1] with ephemeral randomness k: c1 = g^k, c2 = m·y^k (mod p). */\r
export function encrypt(m: number, pub: PublicKey, k: number): Ciphertext {\r
  const { p, g, y } = pub;\r
  return { c1: modpow(g, k, p), c2: (m % p * modpow(y, k, p)) % p };\r
}\r
\r
/** Decrypt (c1, c2) with private key x: m = c2 · (c1^x)⁻¹ (mod p). */\r
export function decrypt(ct: Ciphertext, p: number, x: number): number {\r
  const s = modpow(ct.c1, x, p);      // the shared secret, recomputed\r
  return (ct.c2 * modinv(s, p)) % p;\r
}\r
\r
/** Multiply two ciphertexts componentwise → an encryption of the product of the plaintexts (homomorphism). */\r
export function homomorphicMultiply(a: Ciphertext, b: Ciphertext, p: number): Ciphertext {\r
  return { c1: (a.c1 * b.c1) % p, c2: (a.c2 * b.c2) % p };\r
}\r
`;export{e as default};