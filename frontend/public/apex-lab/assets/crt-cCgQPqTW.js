var e=`// Chinese Remainder Theorem — the math, with the coprimality precondition made testable. When the moduli are pairwise\r
// coprime the map number → (remainders) is a bijection over [0, M): every fingerprint has exactly one preimage, and CRT\r
// reconstructs it as x = Σ rᵢ·eᵢ mod M with the basis eᵢ ≡ 1 (mod mᵢ), ≡ 0 elsewhere. Drop coprimality and the whole\r
// theorem collapses: only lcm(moduli) fingerprints are reachable, so the map is many-to-one — some fingerprints have\r
// several preimages (a collision), others none (a gap). preimages() brute-forces that directly so the failure is shown,\r
// not asserted.\r
\r
export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));\r
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;\r
export const product = (mods: number[]): number => mods.reduce((a, b) => a * b, 1);\r
export const reachable = (mods: number[]): number => mods.reduce((a, b) => lcm(a, b), 1);\r
export const pairwiseCoprime = (mods: number[]): boolean =>\r
  mods.every((m, i) => mods.every((n, j) => i >= j || gcd(m, n) === 1));\r
\r
const modinv = (a: number, m: number): number => {\r
  a = ((a % m) + m) % m;\r
  for (let x = 1; x < m; x++) if ((a * x) % m === 1) return x;\r
  return 1; // no inverse (only happens for non-coprime moduli, where reconstruct is not valid anyway)\r
};\r
\r
// The CRT basis eᵢ = Mᵢ·(Mᵢ⁻¹ mod mᵢ), valid only for coprime moduli.\r
export function basis(mods: number[]): number[] {\r
  const M = product(mods);\r
  return mods.map((mi) => { const Mi = M / mi; return Mi * modinv(Mi, mi); });\r
}\r
export const reconstruct = (rs: number[], mods: number[]): number => {\r
  const E = basis(mods), M = product(mods);\r
  return ((rs.reduce((s, r, i) => s + r * E[i], 0) % M) + M) % M;\r
};\r
\r
// Every x in [0, product) whose remainders match the fingerprint. Length 1 for all fingerprints iff the moduli are\r
// coprime; otherwise some fingerprints collide (length > 1) and some are impossible (length 0).\r
export function preimages(rs: number[], mods: number[]): number[] {\r
  const M = product(mods), out: number[] = [];\r
  for (let x = 0; x < M; x++) if (mods.every((mi, i) => x % mi === rs[i])) out.push(x);\r
  return out;\r
}\r
`;export{e as default};