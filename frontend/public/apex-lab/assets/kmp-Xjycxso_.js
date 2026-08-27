var e=`// Knuth-Morris-Pratt string matching (1977) — find a pattern in text in O(n+m), never\r
// re-examining a text character. A naive search, on a mismatch, slides the pattern one\r
// step and re-compares from scratch — O(n·m). KMP precomputes a FAILURE FUNCTION (the\r
// prefix function π): π[i] = the length of the longest proper prefix of pattern[0..i] that\r
// is also a suffix. On a mismatch after matching k characters, instead of backing up the\r
// text, it slides the pattern so the already-matched prefix π[k-1] lines up — because those\r
// characters are guaranteed to match. The text pointer only ever moves forward. Pure,\r
// tested (against a naive matcher and hand-worked failure tables).\r
\r
/** The prefix function π over the pattern. */\r
export function failure(pattern: string): number[] {\r
  const pi = new Array(pattern.length).fill(0);\r
  let k = 0; // length of the current longest prefix-suffix\r
  for (let i = 1; i < pattern.length; i++) {\r
    while (k > 0 && pattern[i] !== pattern[k]) k = pi[k - 1]; // fall back along the chain\r
    if (pattern[i] === pattern[k]) k++;\r
    pi[i] = k;\r
  }\r
  return pi;\r
}\r
\r
export interface Step { textIndex: number; patIndex: number; match: boolean; jumpedTo: number | null }\r
export interface SearchResult { matches: number[]; steps: Step[]; comparisons: number }\r
\r
/** Find every occurrence of \`pattern\` in \`text\`, recording each comparison. */\r
export function search(text: string, pattern: string): SearchResult {\r
  const pi = failure(pattern);\r
  const matches: number[] = [];\r
  const steps: Step[] = [];\r
  if (pattern.length === 0) return { matches, steps, comparisons: 0 };\r
  let q = 0, comparisons = 0;\r
  for (let i = 0; i < text.length; i++) {\r
    while (q > 0 && text[i] !== pattern[q]) { comparisons++; const to = pi[q - 1]; steps.push({ textIndex: i, patIndex: q, match: false, jumpedTo: to }); q = to; }\r
    comparisons++;\r
    const m = text[i] === pattern[q];\r
    steps.push({ textIndex: i, patIndex: q, match: m, jumpedTo: null });\r
    if (m) q++;\r
    if (q === pattern.length) { matches.push(i - q + 1); q = pi[q - 1]; } // found one; slide for overlaps\r
  }\r
  return { matches, steps, comparisons };\r
}\r
\r
/** Naive O(n·m) matcher, for cross-checking. */\r
export function naiveSearch(text: string, pattern: string): number[] {\r
  const out: number[] = [];\r
  if (!pattern) return out;\r
  for (let i = 0; i + pattern.length <= text.length; i++) {\r
    let j = 0;\r
    while (j < pattern.length && text[i + j] === pattern[j]) j++;\r
    if (j === pattern.length) out.push(i);\r
  }\r
  return out;\r
}\r
`;export{e as default};