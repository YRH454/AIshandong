var e=`// The Burrows-Wheeler Transform — a REVERSIBLE permutation of a string that clusters similar characters\r
// together, which is why it sits at the heart of bzip2. Append a unique sentinel ($, sorting before\r
// every real character), list all rotations of the string, sort them lexicographically, and read off\r
// the LAST column: that's the BWT. It looks like scrambling, but it's a bijection — the inverse rebuilds\r
// the original by repeatedly prepending the BWT column and re-sorting (equivalently, the LF-mapping).\r
// The transform itself compresses nothing; it just makes runs that a move-to-front + RLE + entropy\r
// coder can crush. Exactly testable: BWT("banana$") = "annb$aa", and inverse(forward(s)) == s.\r
// Reference: Burrows & Wheeler, "A Block-sorting Lossless Data Compression Algorithm" (1994).\r
\r
export const SENTINEL = '$';\r
\r
export interface BwtResult { bwt: string; rotations: string[]; sorted: string[]; originalRow: number }\r
\r
/** Forward BWT of \`text\` (a '$' sentinel is appended; \`text\` must not already contain it). */\r
export function forward(text: string): BwtResult {\r
  const s = text + SENTINEL;\r
  const n = s.length;\r
  const rotations = Array.from({ length: n }, (_, i) => s.slice(i) + s.slice(0, i));\r
  const sorted = [...rotations].sort();\r
  const bwt = sorted.map((r) => r[n - 1]).join('');\r
  const originalRow = sorted.indexOf(s);\r
  return { bwt, rotations, sorted, originalRow };\r
}\r
\r
/** Inverse BWT: rebuild the sorted-rotation table column by column, then return the row ending in '$'. */\r
export function inverse(bwt: string): string {\r
  const n = bwt.length;\r
  let table = Array.from({ length: n }, () => '');\r
  for (let k = 0; k < n; k++) {\r
    for (let i = 0; i < n; i++) table[i] = bwt[i] + table[i]; // prepend the BWT column\r
    table.sort();\r
  }\r
  const row = table.find((r) => r.endsWith(SENTINEL))!;\r
  return row.slice(0, -1); // strip the sentinel\r
}\r
\r
/** The last column (the BWT) and the first column (the sorted characters), for visual side-by-side. */\r
export function columns(sorted: string[]): { first: string; last: string } {\r
  const n = sorted.length;\r
  return { first: sorted.map((r) => r[0]).join(''), last: sorted.map((r) => r[n - 1]).join('') };\r
}\r
\r
/** A crude "clustering" score: count adjacent equal characters (higher = more run-friendly for RLE). */\r
export function adjacency(s: string): number {\r
  let runs = 0;\r
  for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1]) runs++;\r
  return runs;\r
}\r
`;export{e as default};