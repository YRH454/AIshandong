var e=`// Jump consistent hash — Google's beautifully small answer to "which of N shards holds this key?" (Lamping &\r
// Veach, 2014). The naive answer, key % N, is a disaster when N changes: add or remove one shard and almost\r
// EVERY key remaps, so a resize reshuffles your whole dataset. Ring-based consistent hashing fixes that but\r
// needs a sorted ring of virtual nodes in memory. Jump hash needs NO memory and about five lines: it replays\r
// a deterministic PRNG seeded by the key and, at each candidate bucket count, "jumps" forward only when the\r
// PRNG says this key should hop to a higher bucket — landing on a final bucket in [0, N). Its two magic\r
// properties: the output is almost perfectly UNIFORM across buckets, and when N grows by one, a key either\r
// stays put or moves to the brand-new bucket — never between two existing buckets — so exactly ~1/(N+1) of\r
// keys move, the theoretical minimum. The catch vs ring hashing: buckets are numbered 0..N-1, so it only\r
// supports adding/removing at the END (great for sharding by count, not for removing an arbitrary node).\r
// Reference: Lamping & Veach, "A Fast, Minimal Memory, Consistent Hash Algorithm" (2014).\r
\r
const M = 2862933555777941757n;      // the LCG multiplier from the paper\r
const U64 = (x: bigint) => BigInt.asUintN(64, x);\r
\r
/** Map a 64-bit key to a bucket in [0, numBuckets). No memory, ~O(ln N) steps. */\r
export function jumpHash(key: bigint, numBuckets: number): number {\r
  let b = -1n, j = 0n, k = U64(key);\r
  const n = BigInt(numBuckets);\r
  while (j < n) {\r
    b = j;\r
    k = U64(k * M + 1n);\r
    j = ((b + 1n) * (1n << 31n)) / ((k >> 33n) + 1n); // jump forward, biased by the PRNG draw\r
  }\r
  return Number(b);\r
}\r
\r
/** 64-bit FNV-1a of a string → bigint key. */\r
export function hashKey(s: string): bigint {\r
  let h = 0xcbf29ce484222325n;\r
  for (let i = 0; i < s.length; i++) { h = U64((h ^ BigInt(s.charCodeAt(i))) * 0x100000001b3n); }\r
  return h;\r
}\r
export const jumpHashStr = (s: string, numBuckets: number): number => jumpHash(hashKey(s), numBuckets);\r
\r
/** The naive alternative, for contrast — key mod N. */\r
export const moduloHash = (key: bigint, numBuckets: number): number => Number(U64(key) % BigInt(numBuckets));\r
\r
/** Fraction of keys that change bucket when going from n buckets to n+1, for a set of keys. */\r
export function movedFraction(hashFn: (k: bigint, n: number) => number, keys: bigint[], n: number): number {\r
  let moved = 0;\r
  for (const k of keys) if (hashFn(k, n) !== hashFn(k, n + 1)) moved++;\r
  return moved / keys.length;\r
}\r
`;export{e as default};