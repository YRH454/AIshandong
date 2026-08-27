var e=`// The hash family and the birthday bound. A hash's collision resistance is only HALF\r
// its output size — 2^(n/2), the birthday bound — and cryptanalysis has pushed the\r
// real cost of MD5 and SHA-1 far below even that. This is honest, sourced status, not\r
// a live collision (generating one took thousands of CPU-years).\r
\r
export interface HashAlg {\r
  name: string;\r
  bits: number;\r
  idealCollisionBits: number; // n/2 — the birthday bound\r
  bestAttackBits: number; // best known collision attack complexity\r
  status: 'broken' | 'safe';\r
  event: string;\r
}\r
\r
export const HASHES: HashAlg[] = [\r
  { name: 'MD5', bits: 128, idealCollisionBits: 64, bestAttackBits: 18, status: 'broken', event: 'collisions in seconds on a laptop (2004–2008); used in the Flame malware to forge a Microsoft cert' },\r
  { name: 'SHA-1', bits: 160, idealCollisionBits: 80, bestAttackBits: 63, status: 'broken', event: 'SHAttered (2017): two PDFs, one SHA-1. Shambles (2020): practical chosen-prefix' },\r
  { name: 'SHA-256', bits: 256, idealCollisionBits: 128, bestAttackBits: 128, status: 'safe', event: 'no collision attack better than brute force; the current default' },\r
  { name: 'SHA3-256', bits: 256, idealCollisionBits: 128, bestAttackBits: 128, status: 'safe', event: 'Keccak sponge; different construction, also no practical attack' },\r
];\r
\r
/** Expected number of random items before a 50% chance of collision in a 2^bits space:\r
 *  ≈ 1.1774 · 2^(bits/2) (the birthday bound). */\r
export function birthday50(bits: number): number {\r
  return 1.1774 * Math.pow(2, bits / 2);\r
}\r
\r
/** P(at least one collision) among k items in a 2^bits space ≈ 1 − e^(−k²/2^(bits+1)). */\r
export function collisionProb(k: number, bits: number): number {\r
  return 1 - Math.exp(-(k * k) / Math.pow(2, bits + 1));\r
}\r
`;export{e as default};