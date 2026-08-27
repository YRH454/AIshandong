var e=`// Boyer-Moore string search — the matcher that gets FASTER on longer patterns by skipping ahead. The\r
// trick: align the pattern under the text and compare from the RIGHT end backward. On a mismatch, the\r
// bad-character rule slides the pattern so the offending text character lines up with its last occurrence\r
// in the pattern (or jumps the pattern clear past it if it doesn't occur at all). A character the pattern\r
// never contains lets you leap a whole pattern-length forward without inspecting the skipped text — which\r
// is why Boyer-Moore is sublinear on typical inputs and is what \`grep\` uses. (Full Boyer-Moore also adds a\r
// "good-suffix" rule; we implement the iconic bad-character heuristic, always shifting >= 1 so it stays\r
// correct.) Reference: Boyer & Moore (CACM 1977); Horspool 1980.\r
\r
export interface BMStep { align: number; mismatchAt: number; matched: boolean; badChar: string; shift: number }\r
export interface BMResult { matches: number[]; steps: BMStep[]; comparisons: number; last: Record<string, number> }\r
\r
/** Last index at which each character appears in the pattern (-1 via the default lookup if absent). */\r
export function lastOccurrence(pattern: string): Record<string, number> {\r
  const last: Record<string, number> = {};\r
  for (let i = 0; i < pattern.length; i++) last[pattern[i]] = i;\r
  return last;\r
}\r
\r
export function search(text: string, pattern: string): BMResult {\r
  const n = text.length, m = pattern.length;\r
  const last = lastOccurrence(pattern);\r
  const matches: number[] = [];\r
  const steps: BMStep[] = [];\r
  let comparisons = 0;\r
  if (m === 0 || m > n) return { matches, steps, comparisons, last };\r
\r
  let i = 0; // current alignment (pattern starts at text[i])\r
  while (i <= n - m) {\r
    let j = m - 1;\r
    while (j >= 0) { comparisons++; if (text[i + j] !== pattern[j]) break; j--; }\r
    if (j < 0) {\r
      matches.push(i);\r
      steps.push({ align: i, mismatchAt: -1, matched: true, badChar: '', shift: 1 });\r
      i += 1; // shift by 1 after a full match (bad-char-only) to catch overlaps\r
    } else {\r
      const c = text[i + j];\r
      const shift = Math.max(1, j - (last[c] ?? -1)); // align c with its last occurrence in the pattern\r
      steps.push({ align: i, mismatchAt: j, matched: false, badChar: c, shift });\r
      i += shift;\r
    }\r
  }\r
  return { matches, steps, comparisons, last };\r
}\r
\r
/** A naive scan's comparison count, for the side-by-side "how much did we save?" contrast. */\r
export function naiveComparisons(text: string, pattern: string): number {\r
  const n = text.length, m = pattern.length;\r
  let comparisons = 0;\r
  for (let i = 0; i + m <= n; i++) for (let j = 0; j < m; j++) { comparisons++; if (text[i + j] !== pattern[j]) break; }\r
  return comparisons;\r
}\r
`;export{e as default};