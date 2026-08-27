var e=`// Longest Increasing Subsequence (LIS) via patience sorting — find the longest run of values that increase\r
// left to right (not necessarily contiguous). The obvious dynamic program is O(n²): for each element, the best\r
// subsequence ending there is 1 + the best among all smaller earlier elements. Patience sorting does it in\r
// O(n log n) with a lovely card-game metaphor. Deal the sequence like solitaire: place each card on the LEFTMOST\r
// pile whose top card is >= it, or start a new pile to the right if none qualifies (greedy). Two facts make this\r
// work: each pile's tops are increasing left to right, so you can find the pile with a BINARY SEARCH; and the\r
// NUMBER OF PILES at the end equals the LIS length (a classic result — you can't have more piles than the LIS is\r
// long, and the greedy placement achieves exactly that). To recover the actual subsequence, when you place a\r
// card, remember the current top of the pile to its left as its predecessor; following those back-pointers from\r
// the last pile reconstructs one longest increasing subsequence. The \`tails\` array the code maintains is exactly\r
// the pile tops: tails[k] is the smallest possible tail value of any increasing subsequence of length k+1, and\r
// binary-searching it for each element is the whole algorithm. LIS shows up in patience-diff (Git's histogram\r
// diff cousin), box stacking, and as the combinatorial heart of the Erdős–Szekeres theorem (any sequence of\r
// n²+1 distinct numbers has a monotone subsequence of length n+1). This models the patience piles, the O(n log n)\r
// binary search, and the reconstruction, cross-checked against the O(n²) DP. Reference: Schensted (1961);\r
// Aldous & Diaconis, "Longest increasing subsequences" (1999).\r
\r
export interface LisResult { length: number; sequence: number[]; indices: number[]; pile: number[] }\r
\r
/** LIS by patience sorting. \`pile[i]\` is the (0-based) pile card i lands on; strictly-increasing subsequence. */\r
export function lis(a: number[]): LisResult {\r
  const tailIdx: number[] = [];                 // tailIdx[k] = index of the current top of pile k\r
  const prev = new Array<number>(a.length).fill(-1);\r
  const pile = new Array<number>(a.length).fill(0);\r
  for (let i = 0; i < a.length; i++) {\r
    // lower_bound: leftmost pile whose top value >= a[i] (strict increase)\r
    let lo = 0, hi = tailIdx.length;\r
    while (lo < hi) { const mid = (lo + hi) >> 1; if (a[tailIdx[mid]] < a[i]) lo = mid + 1; else hi = mid; }\r
    pile[i] = lo;\r
    prev[i] = lo > 0 ? tailIdx[lo - 1] : -1;     // predecessor = current top of the pile to the left\r
    if (lo === tailIdx.length) tailIdx.push(i); else tailIdx[lo] = i;\r
  }\r
  const length = tailIdx.length;\r
  const indices: number[] = [];\r
  for (let k = length > 0 ? tailIdx[length - 1] : -1; k >= 0; k = prev[k]) indices.unshift(k);\r
  return { length, sequence: indices.map((j) => a[j]), indices, pile };\r
}\r
\r
/** The O(n²) dynamic program — length only — for cross-checking. */\r
export function lisLengthDP(a: number[]): number {\r
  if (a.length === 0) return 0;\r
  const dp = a.map(() => 1);\r
  for (let i = 0; i < a.length; i++)\r
    for (let j = 0; j < i; j++)\r
      if (a[j] < a[i]) dp[i] = Math.max(dp[i], dp[j] + 1);\r
  return Math.max(...dp);\r
}\r
`;export{e as default};