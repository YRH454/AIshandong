var e=`// Edit distance (Levenshtein, 1965) — the minimum number of single-character insertions,\r
// deletions, or substitutions to turn one string into another. It's computed by dynamic\r
// programming: dp[i][j] = the cost to convert the first i characters of a into the first j\r
// of b. If the current characters match, no new edit is needed (carry the diagonal);\r
// otherwise it's 1 + the cheapest of deleting (up), inserting (left), or substituting\r
// (diagonal). Filling the table is O(m·n); tracing back from the bottom-right corner\r
// recovers the actual edits. It powers diff, spell-checkers, fuzzy search, and DNA\r
// alignment. Pure, tested against canonical pairs.\r
\r
export type Op = 'match' | 'substitute' | 'insert' | 'delete';\r
export interface Edit { op: Op; a: string; b: string }\r
\r
export interface Result { distance: number; table: number[][]; edits: Edit[] }\r
\r
export function editDistance(a: string, b: string): Result {\r
  const m = a.length, n = b.length;\r
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));\r
  for (let i = 0; i <= m; i++) dp[i][0] = i; // delete all of a's first i chars\r
  for (let j = 0; j <= n; j++) dp[0][j] = j; // insert all of b's first j chars\r
\r
  for (let i = 1; i <= m; i++) {\r
    for (let j = 1; j <= n; j++) {\r
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];\r
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);\r
    }\r
  }\r
\r
  // backtrace one optimal path from (m,n) to (0,0)\r
  const edits: Edit[] = [];\r
  let i = m, j = n;\r
  while (i > 0 || j > 0) {\r
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) { edits.push({ op: 'match', a: a[i - 1], b: b[j - 1] }); i--; j--; }\r
    else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) { edits.push({ op: 'substitute', a: a[i - 1], b: b[j - 1] }); i--; j--; }\r
    else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) { edits.push({ op: 'delete', a: a[i - 1], b: '' }); i--; }\r
    else { edits.push({ op: 'insert', a: '', b: b[j - 1] }); j--; }\r
  }\r
  edits.reverse();\r
  return { distance: dp[m][n], table: dp, edits };\r
}\r
`;export{e as default};