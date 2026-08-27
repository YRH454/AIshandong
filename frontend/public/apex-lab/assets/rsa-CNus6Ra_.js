var e=`// RSA, the original public-key cryptosystem — the trapdoor made visible. Anyone\r
// can compute c = m^e mod n (the public direction); only the holder of d can undo\r
// it, and recovering d means factoring n, which is easy for our small teaching\r
// modulus and astronomically hard at 2048 bits. All arithmetic is real BigInt and\r
// the worked example (p=61, q=53) matches the canonical RSA vector. Sandbox values\r
// only — a teaching keypair, never a real private key.\r
\r
/** Modular exponentiation by square-and-multiply (the engine of RSA). */\r
export function modpow(base: bigint, exp: bigint, mod: bigint): bigint {\r
  let result = 1n;\r
  let b = base % mod;\r
  let e = exp;\r
  while (e > 0n) {\r
    if (e & 1n) result = (result * b) % mod;\r
    b = (b * b) % mod;\r
    e >>= 1n;\r
  }\r
  return result;\r
}\r
\r
export interface ExpStep { bit: number; afterSquare: bigint; multiplied: boolean; value: bigint }\r
\r
/** Square-and-multiply, but processed MSB→LSB and recording each step for the view. */\r
export function modpowTrace(base: bigint, exp: bigint, mod: bigint): { value: bigint; steps: ExpStep[] } {\r
  const bits = exp.toString(2).split('').map(Number); // MSB first\r
  let acc = 1n;\r
  const steps: ExpStep[] = [];\r
  for (const bit of bits) {\r
    acc = (acc * acc) % mod; // square\r
    const afterSquare = acc;\r
    const multiplied = bit === 1;\r
    if (multiplied) acc = (acc * (base % mod)) % mod; // multiply by base when bit set\r
    steps.push({ bit, afterSquare, multiplied, value: acc });\r
  }\r
  return { value: acc, steps };\r
}\r
\r
function egcd(a: bigint, b: bigint): { g: bigint; x: bigint; y: bigint } {\r
  if (b === 0n) return { g: a, x: 1n, y: 0n };\r
  const r = egcd(b, a % b);\r
  return { g: r.g, x: r.y, y: r.x - (a / b) * r.y };\r
}\r
\r
/** Modular inverse a^{-1} mod m (how the private exponent d is derived). */\r
export function modinv(a: bigint, m: bigint): bigint {\r
  const r = egcd(((a % m) + m) % m, m);\r
  if (r.g !== 1n) throw new Error('no inverse — e and φ(n) share a factor');\r
  return ((r.x % m) + m) % m;\r
}\r
\r
export function gcd(a: bigint, b: bigint): bigint {\r
  while (b) { [a, b] = [b, a % b]; }\r
  return a < 0n ? -a : a;\r
}\r
\r
export interface RsaKey {\r
  p: bigint; q: bigint;\r
  n: bigint; phi: bigint; // modulus and Euler totient\r
  e: bigint; d: bigint; // public / private exponents\r
}\r
\r
/** Build an RSA keypair from two primes and a public exponent e. */\r
export function rsaKeygen(p: bigint, q: bigint, e: bigint): RsaKey {\r
  const n = p * q;\r
  const phi = (p - 1n) * (q - 1n);\r
  if (gcd(e, phi) !== 1n) throw new Error('e must be coprime with φ(n)');\r
  const d = modinv(e, phi);\r
  return { p, q, n, phi, e, d };\r
}\r
\r
export const rsaEncrypt = (m: bigint, key: RsaKey) => modpow(m, key.e, key.n); // public\r
export const rsaDecrypt = (c: bigint, key: RsaKey) => modpow(c, key.d, key.n); // private\r
export const rsaSign = (h: bigint, key: RsaKey) => modpow(h, key.d, key.n); // private\r
export const rsaVerify = (s: bigint, key: RsaKey) => modpow(s, key.e, key.n); // public → recovers h\r
\r
/** A few small primes for the picker (all genuinely prime). */\r
export const SMALL_PRIMES = [53n, 59n, 61n, 67n, 71n, 73n, 79n, 83n, 89n, 97n, 101n, 103n, 107n, 109n, 113n];\r
\r
/** Naive factorisation — to show that breaking the small modulus is trivial,\r
 *  and (by contrast) why a 2048-bit n is not. */\r
export function factor(n: bigint): [bigint, bigint] | null {\r
  for (let i = 2n; i * i <= n; i++) if (n % i === 0n) return [i, n / i];\r
  return null;\r
}\r
`;export{e as default};