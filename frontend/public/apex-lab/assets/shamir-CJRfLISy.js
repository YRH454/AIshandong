var e=`// Shamir Secret Sharing — split a secret into n shares so that any k of them rebuild\r
// it, but k−1 reveal NOTHING. The trick is a polynomial of degree k−1 over a finite\r
// field whose constant term IS the secret: f(0) = secret, and each share is a point\r
// (x, f(x)). k points pin down a degree-(k−1) polynomial exactly (Lagrange), so k\r
// shares recover f(0); with only k−1 points, every secret is still equally possible.\r
// Real arithmetic over GF(257) so a secret is one byte. Tested.\r
\r
export const P = 257; // prime > 255, so a secret is a byte 0..255\r
\r
const mod = (n: number) => ((n % P) + P) % P;\r
\r
/** Modular inverse in GF(P) via extended Euclid. */\r
export function modinv(a: number): number {\r
  let [r, nr] = [mod(a), P];\r
  let [t, nt] = [1, 0];\r
  while (nr !== 0) {\r
    const q = Math.floor(r / nr);\r
    [r, nr] = [nr, r - q * nr];\r
    [t, nt] = [nt, t - q * nt];\r
  }\r
  if (r !== 1) throw new Error('not invertible');\r
  return mod(t);\r
}\r
\r
export interface Share { x: number; y: number }\r
\r
/** f(x) = secret + c1·x + … + c_{k-1}·x^{k-1} (mod P); shares are (x, f(x)) for x=1..n. */\r
export function split(secret: number, n: number, k: number, coeffs: number[]): Share[] {\r
  const c = [secret, ...coeffs.slice(0, k - 1)];\r
  const shares: Share[] = [];\r
  for (let x = 1; x <= n; x++) {\r
    let y = 0;\r
    for (let j = 0; j < k; j++) y = mod(y + c[j] * Math.pow(x, j));\r
    shares.push({ x, y: mod(y) });\r
  }\r
  return shares;\r
}\r
\r
/** Lagrange-interpolate the shares back to f(0) = the secret. */\r
export function reconstruct(shares: Share[]): number {\r
  let secret = 0;\r
  for (let i = 0; i < shares.length; i++) {\r
    let num = 1, den = 1;\r
    for (let j = 0; j < shares.length; j++) {\r
      if (i === j) continue;\r
      num = mod(num * (0 - shares[j].x)); // evaluate the basis polynomial at x = 0\r
      den = mod(den * (shares[i].x - shares[j].x));\r
    }\r
    secret = mod(secret + shares[i].y * num * modinv(den));\r
  }\r
  return secret;\r
}\r
`;export{e as default};