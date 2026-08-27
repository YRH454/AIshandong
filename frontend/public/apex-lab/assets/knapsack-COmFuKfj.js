var e=`// 0/1 knapsack — the canonical dynamic program: pick a subset of items, each taken or left whole, to\r
// maximize value without exceeding a weight budget. The greedy "best value-per-weight first" fails here\r
// (a heavy high-value item can beat two light ones), so we fill a table dp[i][w] = the best value using\r
// the first i items within capacity w. Each cell asks one question: is item i worth taking? — take the\r
// better of skipping it (dp[i−1][w]) or taking it (value_i + dp[i−1][w−weight_i]). Backtracking the\r
// chosen cells recovers WHICH items. It's pseudo-polynomial (O(n·W)), the textbook example of why DP\r
// beats brute force on overlapping subproblems. Reference: CLRS ch.15 / standard DP texts.\r
\r
export interface Item { name: string; weight: number; value: number }\r
export interface KnapsackResult { table: number[][]; best: number; chosen: string[]; capacity: number; items: Item[] }\r
\r
export function knapsack(items: Item[], capacity: number): KnapsackResult {\r
  const n = items.length;\r
  // dp[i][w] over i in 0..n, w in 0..capacity. Row 0 (no items) is all zeros.\r
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));\r
  for (let i = 1; i <= n; i++) {\r
    const { weight, value } = items[i - 1];\r
    for (let w = 0; w <= capacity; w++) {\r
      table[i][w] = table[i - 1][w]; // skip item i\r
      if (weight <= w) table[i][w] = Math.max(table[i][w], value + table[i - 1][w - weight]); // or take it\r
    }\r
  }\r
  // backtrack: an item was taken when its row improved on the row above at that capacity\r
  const chosen: string[] = [];\r
  let w = capacity;\r
  for (let i = n; i >= 1; i--) {\r
    if (table[i][w] !== table[i - 1][w]) { chosen.push(items[i - 1].name); w -= items[i - 1].weight; }\r
  }\r
  chosen.reverse();\r
  return { table, best: table[n][capacity], chosen, capacity, items };\r
}\r
\r
/** The greedy value/weight heuristic — included to SHOW it can be beaten on the 0/1 problem. */\r
export function greedyByRatio(items: Item[], capacity: number): { value: number; chosen: string[] } {\r
  const order = [...items].sort((a, b) => b.value / b.weight - a.value / a.weight);\r
  let w = 0, value = 0; const chosen: string[] = [];\r
  for (const it of order) if (w + it.weight <= capacity) { w += it.weight; value += it.value; chosen.push(it.name); }\r
  return { value, chosen };\r
}\r
`;export{e as default};