var e=`// Classical ciphers and why they fall — the pre-history that motivates modern crypto.\r
// Caesar shifts every letter by a fixed amount; Vigenère shifts by a repeating key.\r
// Both are monoalphabetic-ish substitutions that LEAK the language's letter frequencies,\r
// so a frequency attack recovers the key without trying every possibility. We compute\r
// real shifts and a χ² fit against English letter frequencies. Verified to the\r
// canonical Vigenère vector (ATTACKATDAWN / LEMON → LXFOPVEFRNHR).\r
\r
const A = 'A'.charCodeAt(0);\r
const isUpper = (c: number) => c >= 65 && c <= 90;\r
const isLower = (c: number) => c >= 97 && c <= 122;\r
\r
/** English letter frequencies (%) — the fingerprint these ciphers can't hide. */\r
export const ENGLISH_FREQ: Record<string, number> = {\r
  E: 12.7, T: 9.1, A: 8.2, O: 7.5, I: 7.0, N: 6.7, S: 6.3, H: 6.1, R: 6.0, D: 4.3, L: 4.0,\r
  C: 2.8, U: 2.8, M: 2.4, W: 2.4, F: 2.2, G: 2.0, Y: 2.0, P: 1.9, B: 1.5, V: 1.0, K: 0.8,\r
  J: 0.15, X: 0.15, Q: 0.10, Z: 0.07,\r
};\r
\r
/** Caesar shift: rotate each letter by \`shift\` (mod 26); non-letters pass through. */\r
export function caesar(text: string, shift: number): string {\r
  const s = ((shift % 26) + 26) % 26;\r
  let out = '';\r
  for (const ch of text) {\r
    const c = ch.charCodeAt(0);\r
    if (isUpper(c)) out += String.fromCharCode(((c - 65 + s) % 26) + 65);\r
    else if (isLower(c)) out += String.fromCharCode(((c - 97 + s) % 26) + 97);\r
    else out += ch;\r
  }\r
  return out;\r
}\r
\r
/** Vigenère: shift letter i by key[i mod keylen]. decrypt reverses the shift. */\r
export function vigenere(text: string, key: string, decrypt = false): string {\r
  const k = key.toUpperCase().replace(/[^A-Z]/g, '');\r
  if (!k) return text;\r
  let out = '', ki = 0;\r
  for (const ch of text) {\r
    const c = ch.charCodeAt(0);\r
    const letter = isUpper(c) || isLower(c);\r
    if (!letter) { out += ch; continue; }\r
    const base = isUpper(c) ? 65 : 97;\r
    let sh = k.charCodeAt(ki % k.length) - A;\r
    if (decrypt) sh = -sh;\r
    out += String.fromCharCode((((c - base + sh) % 26) + 26) % 26 + base);\r
    ki++;\r
  }\r
  return out;\r
}\r
\r
export function letterCounts(text: string): Record<string, number> {\r
  const counts: Record<string, number> = {};\r
  for (let i = 0; i < 26; i++) counts[String.fromCharCode(65 + i)] = 0;\r
  for (const ch of text.toUpperCase()) if (counts[ch] !== undefined) counts[ch]++;\r
  return counts;\r
}\r
\r
export function letterFreq(text: string): Record<string, number> {\r
  const counts = letterCounts(text);\r
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;\r
  const freq: Record<string, number> = {};\r
  for (const k in counts) freq[k] = (counts[k] / total) * 100;\r
  return freq;\r
}\r
\r
/** Break a Caesar cipher by frequency: pick the shift whose decrypt best fits English. */\r
export function crackCaesar(cipher: string): { shift: number; plaintext: string; chi: number[] } {\r
  const chi: number[] = [];\r
  for (let s = 0; s < 26; s++) {\r
    const freq = letterFreq(caesar(cipher, -s));\r
    let x = 0;\r
    for (let i = 0; i < 26; i++) {\r
      const L = String.fromCharCode(65 + i);\r
      const e = ENGLISH_FREQ[L] ?? 0.05;\r
      x += ((freq[L] - e) ** 2) / e;\r
    }\r
    chi.push(x);\r
  }\r
  const shift = chi.indexOf(Math.min(...chi));\r
  return { shift, plaintext: caesar(cipher, -shift), chi };\r
}\r
`;export{e as default};