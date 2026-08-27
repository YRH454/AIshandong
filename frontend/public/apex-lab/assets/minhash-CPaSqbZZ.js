var e=`// MinHash — a sketch that estimates how SIMILAR two sets are (their Jaccard similarity, |A∩B| / |A∪B|) from\r
// tiny fixed-size signatures, without ever comparing the sets directly. It's the engine behind near-duplicate\r
// detection at scale: finding which of billions of web pages, documents, or genomes are near-copies, deduping\r
// crawls, clustering, plagiarism checks. The magic rests on one clean fact. Take a hash function that shuffles\r
// the universe of possible elements into a random order, and ask: for two sets A and B, what's the probability\r
// that the element with the SMALLEST hash in A is the same as the one with the smallest hash in B? That minimum\r
// comes from A∪B, and it lands in A∩B exactly when the globally-smallest element happens to be shared — which\r
// happens with probability |A∩B|/|A∪B| = the Jaccard similarity, EXACTLY. So one min-hash agrees between A and B\r
// with probability J. Do it with k independent hash functions and you get a k-slot signature per set; the\r
// FRACTION of slots where two signatures agree is an unbiased estimate of J, with error ~1/√k. Signatures are\r
// fixed-size (k numbers) no matter how big the sets are, they're computed once per set, and comparing two is k\r
// integer comparisons — so you can index millions of signatures and (with LSH banding) find similar pairs\r
// without the quadratic blowup. This models the signatures and the estimate. Reference: Broder, "On the\r
// resemblance and containment of documents" (1997); AltaVista's duplicate detection.\r
\r
const P = 2147483647; // 2^31 - 1, a Mersenne prime\r
\r
/** Hash an element to [0, P). */\r
function baseHash(s: string): number {\r
  let h = 2166136261 >>> 0;\r
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }\r
  return h % P;\r
}\r
\r
/** k independent hash functions hᵢ(x) = (aᵢ·x + bᵢ) mod P (a small enough that aᵢ·x stays exact). */\r
export function makeHashes(k: number, seed = 1): { a: number; b: number }[] {\r
  let s = seed >>> 0;\r
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s; };\r
  return Array.from({ length: k }, () => ({ a: 1 + (rnd() % 32767), b: rnd() % P }));\r
}\r
\r
/** The MinHash signature of a set: for each hash function, the minimum hash over the set's elements. */\r
export function signature(set: string[], hashes: { a: number; b: number }[]): number[] {\r
  const xs = [...new Set(set)].map(baseHash);\r
  return hashes.map(({ a, b }) => {\r
    let m = P;\r
    for (const x of xs) { const v = (a * x + b) % P; if (v < m) m = v; }\r
    return m;\r
  });\r
}\r
\r
/** Estimate Jaccard similarity = fraction of signature slots that agree. */\r
export function estimateJaccard(sigA: number[], sigB: number[]): number {\r
  let eq = 0;\r
  for (let i = 0; i < sigA.length; i++) if (sigA[i] === sigB[i]) eq++;\r
  return sigA.length ? eq / sigA.length : 1;\r
}\r
\r
/** Exact Jaccard similarity — the ground truth. */\r
export function trueJaccard(A: string[], B: string[]): number {\r
  const a = new Set(A), b = new Set(B);\r
  let inter = 0;\r
  for (const x of a) if (b.has(x)) inter++;\r
  const uni = a.size + b.size - inter;\r
  return uni === 0 ? 1 : inter / uni;\r
}\r
`;export{e as default};