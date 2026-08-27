var e=`// Password hashing beyond PBKDF2 — why memory-hardness matters. A salt defeats\r
// rainbow tables and a high iteration count makes each guess slow (that's the\r
// PBKDF2 tool in the crypto playground), but PBKDF2 and bcrypt use almost no memory,\r
// so an attacker packs thousands of cheap GPU/ASIC cores and cracks in parallel.\r
// scrypt and Argon2 force each guess to touch a large block of RAM, so parallel\r
// cracking needs proportional memory — collapsing the GPU advantage. We model the\r
// attacker's throughput, assuming the defender tuned every KDF to the SAME cost on\r
// their own server. The gpuAdvantage figures are illustrative orders of magnitude;\r
// the ordering is the real lesson.\r
\r
export interface Kdf {\r
  id: string; name: string; year: number;\r
  memoryKiB: number; // working memory per guess\r
  gpuAdvantage: number; // ~how many× faster a GPU/ASIC cracks it vs one CPU core (illustrative)\r
  defends: string[]; // properties it adds\r
}\r
\r
export const KDFS: Kdf[] = [\r
  { id: 'pbkdf2', name: 'PBKDF2', year: 2000, memoryKiB: 0.001, gpuAdvantage: 1000, defends: ['salt', 'iterations'] },\r
  { id: 'bcrypt', name: 'bcrypt', year: 1999, memoryKiB: 4, gpuAdvantage: 30, defends: ['salt', 'cost factor', 'small fixed memory'] },\r
  { id: 'scrypt', name: 'scrypt', year: 2009, memoryKiB: 16384, gpuAdvantage: 3, defends: ['salt', 'cost', 'memory-hard (N·r)'] },\r
  { id: 'argon2', name: 'Argon2id', year: 2015, memoryKiB: 65536, gpuAdvantage: 1.5, defends: ['salt', 'cost', 'memory-hard', 'parallelism', 'side-channel resistance'] },\r
];\r
\r
export const byId = (id: string): Kdf => KDFS.find((k) => k.id === id)!;\r
\r
// The defender tunes each KDF to take this long on their own server, so on a single\r
// CPU core every KDF gives the attacker the same rate — the GPU is what differs.\r
export const DEFENDER_HASH_SECONDS = 0.25;\r
\r
/** Attacker guesses/sec given a core budget and whether they use GPUs/ASICs. */\r
export function attackerGuessesPerSec(kdf: Kdf, cores: number, gpu: boolean): number {\r
  const perCore = 1 / DEFENDER_HASH_SECONDS;\r
  return cores * perCore * (gpu ? kdf.gpuAdvantage : 1);\r
}\r
\r
/** Expected seconds to crack a password with \`entropyBits\` of entropy (half the space). */\r
export function crackSeconds(kdf: Kdf, entropyBits: number, cores: number, gpu: boolean): number {\r
  const guesses = Math.pow(2, entropyBits - 1);\r
  return guesses / attackerGuessesPerSec(kdf, cores, gpu);\r
}\r
\r
/** Human-friendly duration. */\r
export function humanTime(sec: number): string {\r
  if (!isFinite(sec)) return '∞';\r
  if (sec >= 31557600 * 1e6) return \`\${(sec / 31557600).toExponential(1)} yr\`;\r
  const u: [number, string][] = [[31557600, 'yr'], [86400, 'd'], [3600, 'h'], [60, 'm'], [1, 's']];\r
  for (const [s, label] of u) if (sec >= s) return \`\${(sec / s).toFixed(sec / s >= 10 ? 0 : 1)} \${label}\`;\r
  if (sec >= 1e-3) return \`\${(sec * 1000).toFixed(0)} ms\`;\r
  return \`\${sec.toExponential(1)} s\`;\r
}\r
`;export{e as default};