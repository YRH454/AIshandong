var e=`// Learned index — the idea from "The Case for Learned Index Structures". A sorted index is really a function from a key\r
// to its position, so instead of a B-tree you can fit an actual MODEL of the keys' cumulative distribution: predict the\r
// position from the key, then do a small LOCAL search inside a guaranteed error bound to correct the prediction. On\r
// smooth data one line predicts within a couple of slots — an O(1)-ish lookup smaller and often faster than a B-tree.\r
// The catch is that the error bound is the whole story: on skewed keys a single line fits badly, the max error explodes,\r
// and the local search window grows until it's no better than a scan. This fits the line and computes that error bound.\r
\r
export interface Model { slope: number; intercept: number }\r
\r
// Least-squares fit of index i = slope·key + intercept over the sorted keys (each key's target is its own position).\r
export function fitLinear(keys: number[]): Model {\r
  const n = keys.length;\r
  if (n < 2) return { slope: 0, intercept: 0 };\r
  let sx = 0, sy = 0, sxx = 0, sxy = 0;\r
  for (let i = 0; i < n; i++) { sx += keys[i]; sy += i; sxx += keys[i] * keys[i]; sxy += keys[i] * i; }\r
  const denom = n * sxx - sx * sx;\r
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;\r
  const intercept = (sy - slope * sx) / n;\r
  return { slope, intercept };\r
}\r
\r
export const predict = (m: Model, key: number, n: number): number =>\r
  Math.max(0, Math.min(n - 1, Math.round(m.slope * key + m.intercept)));\r
\r
// The guaranteed error bound: the largest gap between a key's predicted and true position. The local search must cover\r
// ±maxError, so the window it scans is 2·maxError + 1 slots.\r
export function maxError(keys: number[], m: Model): number {\r
  let e = 0;\r
  for (let i = 0; i < keys.length; i++) e = Math.max(e, Math.abs(predict(m, keys[i], keys.length) - i));\r
  return e;\r
}\r
export const searchWindow = (keys: number[], m: Model): number => 2 * maxError(keys, m) + 1;\r
\r
// A B-tree / binary search over n sorted keys costs about ceil(log2 n) comparisons, regardless of the distribution.\r
export const binarySearchCost = (n: number): number => Math.max(1, Math.ceil(Math.log2(n)));\r
`;export{e as default};