var e=`// Dutch National Flag — Dijkstra's elegant one-pass, in-place partition of an array into THREE groups, named\r
// after the red-white-blue flag. Given values from {0, 1, 2}, sort them so all 0s come first, then all 1s, then\r
// all 2s — in a single left-to-right sweep, O(n) time, O(1) extra space, with at most n swaps total.\r
// The trick is three pointers that carve the array into four regions: [0s | 1s | unknown | 2s]. \`low\` marks the\r
// end of the 0s, \`high\` marks the start of the 2s, and \`mid\` scans the unknown region. Look at a[mid]: if it's\r
// a 0, swap it down into the 0s region (low++, mid++); if it's a 1, it's already in place (mid++); if it's a 2,\r
// swap it up into the 2s region (high--) — and DON'T advance mid, because the element you just swapped in from\r
// the top is still unexamined. When mid passes high, the unknown region is empty and you're done. Beyond the\r
// cute flag, this is the partition step of THREE-WAY QUICKSORT: partition around a pivot into (< pivot),\r
// (== pivot), (> pivot), which makes quicksort robust to inputs full of duplicate keys (where classic two-way\r
// quicksort degrades to O(n²)). Reference: Dijkstra, "A Discipline of Programming" (1976).\r
\r
export interface Step { arr: number[]; low: number; mid: number; high: number; action: 'swap-low' | 'skip' | 'swap-high' }\r
\r
/** Sort an array of {0,1,2} in one pass; returns the result and a step trace for visualization. */\r
export function sort(input: number[]): { result: number[]; steps: Step[] } {\r
  const a = input.slice();\r
  let low = 0, mid = 0, high = a.length - 1;\r
  const steps: Step[] = [];\r
  while (mid <= high) {\r
    if (a[mid] === 0) {\r
      [a[low], a[mid]] = [a[mid], a[low]];\r
      steps.push({ arr: a.slice(), low, mid, high, action: 'swap-low' });\r
      low++; mid++;\r
    } else if (a[mid] === 1) {\r
      steps.push({ arr: a.slice(), low, mid, high, action: 'skip' });\r
      mid++;\r
    } else {\r
      [a[mid], a[high]] = [a[high], a[mid]];\r
      steps.push({ arr: a.slice(), low, mid, high, action: 'swap-high' });\r
      high--;\r
    }\r
  }\r
  return { result: a, steps };\r
}\r
\r
/** The generalized partition step of 3-way quicksort: reorder \`a\` into (<pivot)(==pivot)(>pivot).\r
 *  Returns the boundaries [lt, gt): a[lt..gt-1] are all == pivot. */\r
export function threeWayPartition(input: number[], pivot: number): { arr: number[]; lt: number; gt: number } {\r
  const a = input.slice();\r
  let lt = 0, i = 0, gt = a.length;\r
  while (i < gt) {\r
    if (a[i] < pivot) { [a[lt], a[i]] = [a[i], a[lt]]; lt++; i++; }\r
    else if (a[i] > pivot) { gt--; [a[i], a[gt]] = [a[gt], a[i]]; }\r
    else i++;\r
  }\r
  return { arr: a, lt, gt };\r
}\r
`;export{e as default};