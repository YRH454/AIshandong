var e=`// Rabin-Karp string matching (1987) — find a pattern by comparing HASHES instead of\r
// characters. The trick is the ROLLING HASH: treat a window of text as a base-b number mod\r
// a prime; when the window slides one character, update the hash in O(1) by subtracting the\r
// leaving character's contribution, multiplying by the base, and adding the entering one —\r
// no need to re-hash the whole window. Where the window hash equals the pattern hash, do a\r
// full character check to rule out a collision. The same rolling hash underlies rsync's\r
// block matching, content-defined chunking (dedup), and multi-pattern search. Pure, tested.\r
\r
export const BASE = 256;\r
export const PRIME = 1_000_000_007;\r
\r
function hashOf(s: string): number {\r
  let h = 0;\r
  for (let i = 0; i < s.length; i++) h = (h * BASE + s.charCodeAt(i)) % PRIME;\r
  return h;\r
}\r
\r
export interface Step { start: number; windowHash: number; hashMatch: boolean; verified: boolean }\r
export interface Result { matches: number[]; steps: Step[]; hashHits: number; falsePositives: number }\r
\r
export function search(text: string, pattern: string): Result {\r
  const m = pattern.length, n = text.length;\r
  const matches: number[] = [], steps: Step[] = [];\r
  if (m === 0 || m > n) return { matches, steps, hashHits: 0, falsePositives: 0 };\r
\r
  const patHash = hashOf(pattern);\r
  let high = 1; // BASE^(m-1) mod PRIME, the weight of the leaving character\r
  for (let i = 0; i < m - 1; i++) high = (high * BASE) % PRIME;\r
\r
  let windowHash = hashOf(text.slice(0, m));\r
  let hashHits = 0, falsePositives = 0;\r
\r
  for (let i = 0; i + m <= n; i++) {\r
    const hashMatch = windowHash === patHash;\r
    let verified = false;\r
    if (hashMatch) {\r
      hashHits++;\r
      verified = text.substr(i, m) === pattern; // full check rules out a hash collision\r
      if (verified) matches.push(i); else falsePositives++;\r
    }\r
    steps.push({ start: i, windowHash, hashMatch, verified });\r
    // roll the hash forward one character\r
    if (i + m < n) {\r
      windowHash = ((windowHash - text.charCodeAt(i) * high) * BASE + text.charCodeAt(i + m)) % PRIME;\r
      windowHash = ((windowHash % PRIME) + PRIME) % PRIME; // keep it non-negative\r
    }\r
  }\r
  return { matches, steps, hashHits, falsePositives };\r
}\r
\r
/** The rolling-hash update in isolation (for showing the O(1) step). */\r
export function roll(prevHash: number, leaving: string, entering: string, m: number): number {\r
  let high = 1;\r
  for (let i = 0; i < m - 1; i++) high = (high * BASE) % PRIME;\r
  let h = ((prevHash - leaving.charCodeAt(0) * high) * BASE + entering.charCodeAt(0)) % PRIME;\r
  return ((h % PRIME) + PRIME) % PRIME;\r
}\r
\r
export const windowHash = hashOf;\r
\r
export function naiveSearch(text: string, pattern: string): number[] {\r
  const out: number[] = [];\r
  if (!pattern) return out;\r
  for (let i = 0; i + pattern.length <= text.length; i++) if (text.substr(i, pattern.length) === pattern) out.push(i);\r
  return out;\r
}\r
`;export{e as default};