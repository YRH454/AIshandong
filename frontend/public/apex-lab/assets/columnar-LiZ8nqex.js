var e=`// Columnar storage encoding — why Parquet/Arrow/ClickHouse keep a table by column instead of by row. Storing a column\r
// contiguously lets a query scan only the columns it needs, and puts similar values next to each other so they compress\r
// with cheap, vectorizable schemes. Two workhorses: DICTIONARY encoding maps the distinct values to small integer codes\r
// plus a dictionary (a win when cardinality ≪ rows), and RUN-LENGTH encoding replaces a run of equal codes with a\r
// (code, count) pair (a win when the column is sorted/clustered). This models the byte sizes of each stage so you can\r
// see when they crush a column and when they backfire. Sizes are the encoded-payload bytes, not a specific file format's\r
// exact framing.\r
\r
export interface Encoded {\r
  n: number; distinct: number; raw: number;\r
  codeBits: number; codedBytes: number; dictBytes: number; dictTotal: number;\r
  runs: number; rleBytes: number; rleTotal: number;\r
}\r
\r
const RUN_OVERHEAD = 2; // bytes to store a run's repeat count (a uint16)\r
\r
export function encode(values: string[]): Encoded {\r
  const n = values.length;\r
  const raw = values.reduce((s, v) => s + v.length, 0);            // 1 byte/char, read whole on a row scan\r
  const distinctSet = new Set(values);\r
  const distinct = distinctSet.size;\r
  const codeBits = Math.max(1, Math.ceil(Math.log2(distinct)));    // bits per dictionary code\r
  const codedBytes = Math.ceil((n * codeBits) / 8);               // bit-packed codes\r
  const dictBytes = [...distinctSet].reduce((s, v) => s + v.length, 0); // each distinct value stored once\r
  const dictTotal = dictBytes + codedBytes;\r
\r
  let runs = 0;\r
  for (let i = 0; i < n; i++) if (i === 0 || values[i] !== values[i - 1]) runs++;\r
  const rleBytes = runs * (Math.ceil(codeBits / 8) + RUN_OVERHEAD); // each run = code + count\r
  const rleTotal = dictBytes + rleBytes;\r
\r
  return { n, distinct, raw, codeBits, codedBytes, dictBytes, dictTotal, runs, rleBytes, rleTotal };\r
}\r
\r
export const ratio = (raw: number, encoded: number): number => (encoded === 0 ? 0 : raw / encoded);\r
`;export{e as default};