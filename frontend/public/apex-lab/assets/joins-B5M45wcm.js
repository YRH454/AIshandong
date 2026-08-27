var e=`// Join algorithms — the three ways a database matches rows of R against rows of S on a join key, and\r
// why the optimizer cares which it picks. All three produce the IDENTICAL result; what differs is the\r
// work. Nested-loop compares every pair (|R|·|S|). Hash join builds a hash table on one side, then\r
// probes it once per row of the other (≈|R|+|S|), but needs memory and an equi-join. Sort-merge sorts\r
// both sides once (O(n log n)) then sweeps them with two cursors in a single linear pass — and leaves\r
// the output sorted. Comparison counts here are exact and hand-verifiable (see tests).\r
// Reference: Ramakrishnan & Gehrke / Garcia-Molina, the join-algorithms & cost chapters.\r
\r
export interface Row { row: string; key: number }\r
export type Pair = [string, string]; // [R.row, S.row]\r
\r
const pairKey = (p: Pair) => \`\${p[0]}|\${p[1]}\`;\r
/** Order-independent equality of two join results (all algorithms must agree). */\r
export const sameResult = (a: Pair[], b: Pair[]): boolean => {\r
  const sa = a.map(pairKey).sort(), sb = b.map(pairKey).sort();\r
  return sa.length === sb.length && sa.every((x, i) => x === sb[i]);\r
};\r
\r
// ── nested-loop join: compare every (r, s) pair ───────────────────────────────\r
export interface NljResult { pairs: Pair[]; comparisons: number }\r
export function nestedLoop(R: Row[], S: Row[]): NljResult {\r
  const pairs: Pair[] = [];\r
  let comparisons = 0;\r
  for (const r of R) for (const s of S) { comparisons++; if (r.key === s.key) pairs.push([r.row, s.row]); }\r
  return { pairs, comparisons };\r
}\r
\r
// ── hash join: build a hash table on S, then probe once per row of R ───────────\r
export interface HashResult { pairs: Pair[]; buildOps: number; probeLookups: number; probeComparisons: number; buckets: { key: number; rows: string[] }[] }\r
export function hashJoin(R: Row[], S: Row[]): HashResult {\r
  const table = new Map<number, string[]>();\r
  for (const s of S) { const b = table.get(s.key) ?? []; b.push(s.row); table.set(s.key, b); } // build\r
  const pairs: Pair[] = [];\r
  let probeComparisons = 0;\r
  for (const r of R) {\r
    const bucket = table.get(r.key);\r
    if (bucket) for (const s of bucket) { probeComparisons++; pairs.push([r.row, s]); } // exact-key bucket → every entry matches\r
  }\r
  const buckets = [...table.entries()].map(([key, rows]) => ({ key, rows })).sort((a, b) => a.key - b.key);\r
  return { pairs, buildOps: S.length, probeLookups: R.length, probeComparisons, buckets };\r
}\r
\r
// ── sort-merge join: sort both, then sweep with two cursors ────────────────────\r
export interface MergeResult { pairs: Pair[]; mergeComparisons: number; sortedR: Row[]; sortedS: Row[] }\r
export function sortMerge(R: Row[], S: Row[]): MergeResult {\r
  const sortedR = [...R].sort((a, b) => a.key - b.key);\r
  const sortedS = [...S].sort((a, b) => a.key - b.key);\r
  const pairs: Pair[] = [];\r
  let i = 0, j = 0, mergeComparisons = 0;\r
  while (i < sortedR.length && j < sortedS.length) {\r
    mergeComparisons++;\r
    const k = sortedR[i].key, l = sortedS[j].key;\r
    if (k < l) i++;\r
    else if (k > l) j++;\r
    else {\r
      // equal key: emit the cross-product of the equal runs on both sides\r
      let iEnd = i; while (iEnd < sortedR.length && sortedR[iEnd].key === k) iEnd++;\r
      let jEnd = j; while (jEnd < sortedS.length && sortedS[jEnd].key === k) jEnd++;\r
      for (let a = i; a < iEnd; a++) for (let b = j; b < jEnd; b++) pairs.push([sortedR[a].row, sortedS[b].row]);\r
      i = iEnd; j = jEnd;\r
    }\r
  }\r
  return { pairs, mergeComparisons, sortedR, sortedS };\r
}\r
`;export{e as default};