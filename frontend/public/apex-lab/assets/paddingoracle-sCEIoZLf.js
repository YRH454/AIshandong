var e=`// The padding-oracle attack — how a server that merely tells you "your padding is valid / invalid" leaks the\r
// entire plaintext of a CBC-encrypted message, without the key. CBC decryption computes\r
// P_i = Decrypt(C_i) XOR C_{i-1}. The block Decrypt(C_i) — call it the "intermediate" I_i — depends only on the\r
// key and C_i, NOT on C_{i-1}. So if the attacker sends a forged previous block C', the server decrypts to\r
// I_i XOR C', and (crucially) checks the PKCS#7 padding of the result before doing anything else. By tampering\r
// with C' one byte at a time and watching whether the padding check passes, the attacker learns I_i byte by\r
// byte: force the last byte to be 0x01 (valid padding of length 1), and you've learned I_i's last byte =\r
// C'_last XOR 0x01. Then force the last two bytes to 0x02 0x02, and so on up the block. Once I_i is known,\r
// XOR with the REAL C_{i-1} gives the true plaintext P_i. About 128 oracle queries per byte on average —\r
// cheap. This broke countless TLS/CBC deployments and ASP.NET (2010). The fixes are encrypt-then-MAC / AEAD\r
// (verify a MAC before ever looking at padding) and constant-time, oracle-free error handling.\r
// Reference: Vaudenay, "Security Flaws Induced by CBC Padding" (2002).\r
\r
export const B = 8; // block size in bytes\r
\r
const xorBytes = (a: number[], b: number[]) => a.map((x, i) => x ^ b[i]);\r
\r
/** PKCS#7 padding check — the single bit of information the oracle leaks. */\r
export function validPKCS7(block: number[]): boolean {\r
  const k = block[B - 1];\r
  if (k < 1 || k > B) return false;\r
  for (let i = B - k; i < B; i++) if (block[i] !== k) return false;\r
  return true;\r
}\r
\r
// The oracle: decrypt (I XOR prev) and report only whether its padding is valid. \`I\` is the intermediate the\r
// attacker is trying to learn — the oracle NEVER reveals it directly.\r
export type Oracle = (prev: number[]) => boolean;\r
export const makeOracle = (intermediate: number[]): Oracle => (prev) => validPKCS7(xorBytes(intermediate, prev));\r
\r
/** Recover the intermediate block I byte-by-byte using only the boolean oracle. Returns I and the query count. */\r
export function recoverIntermediate(oracle: Oracle): { intermediate: number[]; queries: number } {\r
  const I = new Array(B).fill(0);\r
  let queries = 0;\r
  for (let pad = 1; pad <= B; pad++) {\r
    const pos = B - pad;\r
    const prev = new Array(B).fill(0);\r
    for (let j = pos + 1; j < B; j++) prev[j] = I[j] ^ pad; // make the known tail decrypt to \`pad\`\r
    let found = -1;\r
    for (let g = 0; g <= 255; g++) {\r
      prev[pos] = g;\r
      queries++;\r
      if (!oracle(prev)) continue;\r
      // guard against a false positive (a longer valid padding): perturb the byte left of pos and re-check.\r
      if (pos > 0) {\r
        const saved = prev[pos - 1];\r
        prev[pos - 1] = (saved + 1) & 0xff;\r
        queries++;\r
        const still = oracle(prev);\r
        prev[pos - 1] = saved;\r
        if (!still) continue; // it was really a longer padding, keep searching\r
      }\r
      found = g;\r
      break;\r
    }\r
    if (found < 0) throw new Error(\`no byte found for pad \${pad}\`);\r
    I[pos] = found ^ pad; // P'[pos] = I[pos] XOR prev[pos] == pad  ⇒  I[pos] = prev[pos] XOR pad\r
  }\r
  return { intermediate: I, queries };\r
}\r
\r
export interface Attack { recovered: number[]; queries: number; matches: boolean }\r
\r
/** Full demo: given a plaintext block (valid PKCS#7) and the real previous block/IV, recover the plaintext\r
 *  purely through the padding oracle — proving it matches without the attacker ever knowing the key or I. */\r
export function attackBlock(plaintext: number[], prevBlock: number[]): Attack {\r
  const intermediate = xorBytes(plaintext, prevBlock);       // the "true" Decrypt(C_i) = P XOR C_{i-1}\r
  const oracle = makeOracle(intermediate);                    // server leaks only padding validity\r
  const { intermediate: recoveredI, queries } = recoverIntermediate(oracle);\r
  const recovered = xorBytes(recoveredI, prevBlock);          // plaintext = I XOR real previous block\r
  return { recovered, queries, matches: recovered.every((b, i) => b === plaintext[i]) };\r
}\r
\r
export interface Step { pos: number; plaintextByte: number; padTarget: number; queries: number }\r
\r
/** Same attack, but records each byte as it falls — recovery order is last byte (pad 1) → first byte (pad B). */\r
export function attackTraced(plaintext: number[], prevBlock: number[]): { steps: Step[]; recovered: number[]; totalQueries: number; matches: boolean } {\r
  const intermediate = xorBytes(plaintext, prevBlock);\r
  const oracle = makeOracle(intermediate);\r
  const I = new Array(B).fill(0);\r
  const steps: Step[] = [];\r
  let total = 0;\r
  for (let pad = 1; pad <= B; pad++) {\r
    const pos = B - pad;\r
    const prev = new Array(B).fill(0);\r
    for (let j = pos + 1; j < B; j++) prev[j] = I[j] ^ pad;\r
    let found = -1, q = 0;\r
    for (let g = 0; g <= 255; g++) {\r
      prev[pos] = g; q++;\r
      if (!oracle(prev)) continue;\r
      if (pos > 0) { const s = prev[pos - 1]; prev[pos - 1] = (s + 1) & 0xff; q++; const ok = oracle(prev); prev[pos - 1] = s; if (!ok) continue; }\r
      found = g; break;\r
    }\r
    I[pos] = found ^ pad; total += q;\r
    steps.push({ pos, plaintextByte: I[pos] ^ prevBlock[pos], padTarget: pad, queries: q });\r
  }\r
  const recovered = xorBytes(I, prevBlock);\r
  return { steps, recovered, totalQueries: total, matches: recovered.every((b, i) => b === plaintext[i]) };\r
}\r
\r
/** Turn a short string into one PKCS#7-padded block. */\r
export function padBlock(s: string): number[] {\r
  const bytes = [...s].flatMap((c) => [...new TextEncoder().encode(c)]).slice(0, B);\r
  const k = B - bytes.length;\r
  return k === 0 ? bytes : bytes.concat(new Array(k).fill(k));\r
}\r
`;export{e as default};