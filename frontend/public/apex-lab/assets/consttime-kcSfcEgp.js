var e=`// Constant-time comparison & the timing side channel — why you must never check a secret (a token,\r
// an HMAC, a password hash) with an ordinary \`==\` or memcmp. A naive comparison returns the instant\r
// it finds a mismatched byte, so HOW LONG it runs leaks HOW MANY leading bytes were correct. An\r
// attacker who can measure that turns an exponential guess (256^n) into a LINEAR one (256·n): fix\r
// byte 0, try all values, keep the one that ran longest (it matched), move to byte 1, and so on.\r
// The fix is to always compare every byte and OR the differences together, so the running time is\r
// independent of the data. We model the leak with an "examined bytes" counter standing in for time,\r
// and run the attack against both comparators. Pure, tested.\r
\r
export interface CmpResult { equal: boolean; examined: number } // examined = bytes touched ≈ time taken\r
\r
/** The VULNERABLE comparison: bails out at the first mismatch, leaking the matching-prefix length. */\r
export function naiveEqual(secret: string, guess: string): CmpResult {\r
  const n = Math.min(secret.length, guess.length);\r
  for (let i = 0; i < n; i++) if (secret[i] !== guess[i]) return { equal: false, examined: i + 1 };\r
  if (secret.length !== guess.length) return { equal: false, examined: n + 1 };\r
  return { equal: true, examined: secret.length };\r
}\r
\r
/** The SAFE comparison: always touches every byte, so the time is constant in the data. */\r
export function constantTimeEqual(secret: string, guess: string): CmpResult {\r
  let diff = secret.length ^ guess.length;\r
  const n = Math.max(secret.length, guess.length);\r
  for (let i = 0; i < n; i++) diff |= (secret.charCodeAt(i) || 0) ^ (guess.charCodeAt(i) || 0);\r
  return { equal: diff === 0, examined: n }; // examined never depends on WHERE a mismatch is\r
}\r
\r
export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');\r
\r
export interface Attack {\r
  recovered: string;\r
  probes: number; // total comparisons made\r
  trail: { pos: number; byte: string; examined: number; chosen: boolean }[]; // per-probe, for visualization\r
  success: boolean;\r
}\r
\r
/** Recover \`secret\` byte-by-byte through a comparison oracle. With the leaky comparator this needs\r
 *  only alphabet·length probes; with the constant-time one the timing signal is gone and it fails. */\r
export function timingAttack(secret: string, cmp: (s: string, g: string) => CmpResult, alphabet = ALPHABET): Attack {\r
  const recovered = new Array(secret.length).fill(alphabet[0]);\r
  const trail: Attack['trail'] = [];\r
  let probes = 0;\r
  for (let pos = 0; pos < secret.length; pos++) {\r
    let bestScore = -1, bestByte = alphabet[0];\r
    for (const b of alphabet) {\r
      recovered[pos] = b;\r
      const r = cmp(secret, recovered.join(''));\r
      probes++;\r
      const score = r.examined + (r.equal ? 1 : 0); // longest run (and a full match) wins\r
      const chosen = score > bestScore;\r
      if (chosen) { bestScore = score; bestByte = b; }\r
      trail.push({ pos, byte: b, examined: r.examined, chosen });\r
    }\r
    recovered[pos] = bestByte;\r
  }\r
  const out = recovered.join('');\r
  return { recovered: out, probes, trail, success: out === secret };\r
}\r
`;export{e as default};