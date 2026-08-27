var e=`// Suffix array — a sorted index of every suffix of a string, and the workhorse behind fast full-text\r
// search. List all n suffixes, sort them lexicographically, and store their starting positions: that's\r
// the suffix array. Because the suffixes are sorted, every occurrence of a pattern P is a CONTIGUOUS\r
// block of them (all the suffixes that start with P), so you find all matches with two binary searches —\r
// O(m log n) — after an O(n log n) build, using just an integer array instead of a bulky tree. It's the\r
// space-frugal cousin of the suffix tree and the backbone of full-text indexes, bioinformatics (genome\r
// search), and the BWT (the BWT is literally the character before each sorted suffix). Reference: Manber\r
// & Myers (1990); Gonnet's PAT arrays.\r
\r
/** Build the suffix array: the starting indices of all suffixes, sorted by suffix. (O(n² log n) naive\r
 *  sort — clear and exact for the demo; production uses an O(n) / O(n log n) construction.) */\r
export function buildSuffixArray(s: string): number[] {\r
  return Array.from({ length: s.length }, (_, i) => i).sort((a, b) => (s.slice(a) < s.slice(b) ? -1 : 1));\r
}\r
\r
/** The lexicographically-sorted suffixes (for display), aligned with the suffix array. */\r
export const sortedSuffixes = (s: string, sa: number[]) => sa.map((i) => s.slice(i));\r
\r
/** Find every start position of \`pattern\` in \`s\`, via the contiguous range of suffixes that begin with\r
 *  it. Returns the SA index range [lo, hi) and the text positions. */\r
export function search(s: string, sa: number[], pattern: string): { lo: number; hi: number; positions: number[] } {\r
  const cmp = (i: number) => s.slice(i, i + pattern.length).localeCompare(pattern);\r
  // lower bound: first suffix >= pattern\r
  let lo = 0, hi = sa.length;\r
  while (lo < hi) { const mid = (lo + hi) >> 1; if (s.slice(sa[mid], sa[mid] + pattern.length) < pattern) lo = mid + 1; else hi = mid; }\r
  // upper bound: first suffix whose prefix > pattern\r
  let lo2 = lo, hi2 = sa.length;\r
  while (lo2 < hi2) { const mid = (lo2 + hi2) >> 1; if (s.slice(sa[mid], sa[mid] + pattern.length) <= pattern) lo2 = mid + 1; else hi2 = mid; }\r
  const range = sa.slice(lo, lo2).filter((i) => cmp(i) === 0);\r
  return { lo, hi: lo2, positions: [...range].sort((a, b) => a - b) };\r
}\r
`;export{e as default};