var e=`// Bitmap index — the indexing trick that makes "SELECT ... WHERE" fly over columns with few distinct values\r
// (status, country, gender, category), the workhorse of data warehouses and columnar stores. A normal B-tree\r
// index maps one value to a list of row IDs; that's great for high-cardinality columns you look up one value at\r
// a time, but terrible for analytics that AND/OR several low-cardinality conditions. A bitmap index instead\r
// keeps, for each distinct value of a column, a BITMAP: a string of bits, one per row, with a 1 wherever that\r
// row has that value. So "colour = red" is one bitmap, "size = L" is another. The magic is that a WHERE clause\r
// combining conditions becomes raw BITWISE arithmetic on those bitmaps — AND for conjunction, OR for\r
// disjunction, NOT for negation — which a CPU does 64 rows at a time, with no row visited that doesn't match.\r
// A query like \`WHERE colour = red AND size = L AND region != EU\` is three bitmap lookups and two ANDs and a\r
// complement, producing the exact set of matching rows as a single bitmap you can then count (popcount) or\r
// iterate. Bitmaps also compress beautifully when sparse (run-length / Roaring), so a column with millions of\r
// rows but a handful of values costs very little. The classic caveat — updates are expensive because you touch\r
// every value's bitmap — is why they shine in read-mostly analytics, not OLTP. This models the index and\r
// bitwise query evaluation. Reference: O'Neil, "Model 204" bitmap indexes (1987); every columnar DB since.\r
\r
export interface Predicate { col: string; value: string; negate?: boolean }\r
export type Row = Record<string, string>;\r
export type Index = Record<string, Record<string, number>>; // col -> value -> row bitmap (bit i = row i)\r
\r
const allOnes = (n: number) => (n >= 31 ? 0x7fffffff : (1 << n) - 1);\r
\r
/** Build a bitmap per (column, value): bit i is set when row i has that value. */\r
export function buildIndex(rows: Row[], cols: string[]): Index {\r
  const idx: Index = {};\r
  for (const col of cols) {\r
    idx[col] = {};\r
    rows.forEach((r, i) => { const v = r[col]; idx[col][v] = (idx[col][v] ?? 0) | (1 << i); });\r
  }\r
  return idx;\r
}\r
\r
/** The bitmap for a single predicate (complemented within nRows if negated). */\r
export function predicateMask(idx: Index, p: Predicate, nRows: number): number {\r
  const base = (idx[p.col]?.[p.value] ?? 0) >>> 0;\r
  return (p.negate ? ~base & allOnes(nRows) : base) >>> 0;\r
}\r
\r
/** Evaluate a query: combine predicate bitmaps with AND or OR. Returns the matching-rows bitmap. */\r
export function evalQuery(idx: Index, preds: Predicate[], op: 'AND' | 'OR', nRows: number): number {\r
  if (preds.length === 0) return op === 'AND' ? allOnes(nRows) : 0;\r
  let acc = op === 'AND' ? allOnes(nRows) : 0;\r
  for (const p of preds) { const m = predicateMask(idx, p, nRows); acc = op === 'AND' ? acc & m : acc | m; }\r
  return acc >>> 0;\r
}\r
\r
/** Ground truth: filter the rows directly, without the index. */\r
export function bruteForce(rows: Row[], preds: Predicate[], op: 'AND' | 'OR'): number {\r
  let mask = 0;\r
  rows.forEach((r, i) => {\r
    const results = preds.map((p) => (p.negate ? r[p.col] !== p.value : r[p.col] === p.value));\r
    const match = preds.length === 0 ? true : op === 'AND' ? results.every(Boolean) : results.some(Boolean);\r
    if (match) mask |= (1 << i);\r
  });\r
  return mask >>> 0;\r
}\r
\r
export const popcount = (mask: number): number => { let c = 0, m = mask >>> 0; while (m) { c += m & 1; m >>>= 1; } return c; };\r
export const bitsToRows = (mask: number, n: number): number[] => Array.from({ length: n }, (_, i) => i).filter((i) => (mask >>> i) & 1);\r
`;export{e as default};