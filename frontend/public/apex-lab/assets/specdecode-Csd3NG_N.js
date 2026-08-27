var e=`// Speculative decoding — how an LLM emits several tokens per expensive forward pass without changing its output. Normal\r
// autoregressive decoding is one big-model pass per token. Here a cheap DRAFT model guesses the next k tokens; the big\r
// TARGET model then verifies all k in a SINGLE pass (it can score every position at once). You keep the longest prefix\r
// where the draft matches what the target would have chosen, take the target's own token at the first disagreement (so\r
// you always advance by at least one real token), and discard the rest. The result is bit-for-bit what the target alone\r
// would produce — just faster when the draft is good. This models the accept/reject accounting.\r
\r
export interface Verify { accepted: number; rejected: number; firstMismatch: number }\r
\r
// draftMatches[i] = did the draft's i-th proposed token equal the target's greedy choice at that position?\r
export function verify(draftMatches: boolean[]): Verify {\r
  const k = draftMatches.length;\r
  let firstMismatch = draftMatches.indexOf(false);\r
  if (firstMismatch === -1) firstMismatch = k;      // the whole draft matched\r
  // accept the matching prefix, plus one token: the target's correction at the mismatch, or a free bonus token when\r
  // every draft token matched (the target's pass also produces the next token).\r
  return { accepted: firstMismatch + 1, rejected: k - firstMismatch, firstMismatch };\r
}\r
\r
// Tokens produced per (expensive) target forward pass — the speedup over plain decoding, which is 1 token per pass.\r
export function speedup(v: Verify): number {\r
  return v.accepted; // accepted tokens all came from a single target pass\r
}\r
`;export{e as default};