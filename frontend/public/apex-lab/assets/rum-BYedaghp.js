var e=`// The RUM conjecture — you can optimize a storage engine for at most two of Read, Update (write), and\r
// Memory (space) amplification; the third pays. This is why B-trees, leveled-LSM and tiered-LSM exist\r
// side by side: each picks a different corner to sacrifice. We compute the standard analytical\r
// amplifications as a function of the dataset size N, the LSM size ratio T, and the B-tree fanout B.\r
//   • read amp   = extra I/Os per point lookup\r
//   • write amp  = bytes (re)written per logical write, from compaction\r
//   • space amp  = storage used ÷ logical data size\r
// These are the textbook formulas, not measurements — labelled as such in the UI. Reference:\r
// Athanassoulis et al., "Designing Access Methods: The RUM Conjecture" (EDBT 2016); Dayan et al. on\r
// LSM tuning ("Monkey", SIGMOD 2017); the standard leveled-vs-tiered compaction analysis.\r
\r
export interface Amp { read: number; write: number; space: number }\r
export interface RumResult { levels: number; btreeHeight: number; btree: Amp; leveled: Amp; tiered: Amp }\r
\r
const clampLog = (n: number, base: number) => Math.max(1, Math.ceil(Math.log(n) / Math.log(base)));\r
const round2 = (x: number) => Math.round(x * 100) / 100;\r
\r
export function amplification(N: number, T: number, B: number): RumResult {\r
  const levels = clampLog(N, T);          // number of LSM levels ≈ log_T(N)\r
  const btreeHeight = clampLog(N, B);     // B-tree height ≈ log_B(N), in page reads\r
\r
  return {\r
    levels,\r
    btreeHeight,\r
    // B-tree: read-optimized. Few page reads per lookup; in-place update writes one page; ~1/fill space.\r
    btree: { read: btreeHeight, write: 1, space: 1.5 },\r
    // Leveled LSM: space-optimized. One run per level (compact eagerly) → low space, but each entry is\r
    // rewritten ~T times per level across L levels → high write amp; a point read may probe each level.\r
    leveled: { read: levels, write: T * levels, space: round2((T + 1) / T) },\r
    // Tiered LSM: write-optimized. Up to T runs per level (compact lazily) → entries written once per\r
    // level (low write amp) but a read probes ~T runs per level, and space holds up to T copies.\r
    tiered: { read: T * levels, write: levels, space: T },\r
  };\r
}\r
\r
/** Which of R/U/M each engine sacrifices (its worst dimension), for the RUM-triangle labelling. */\r
export function sacrifices(a: Amp): 'read' | 'write' | 'space' {\r
  // normalize against rough "good" baselines so the dimensions are comparable\r
  const r = a.read / 3, w = a.write / 5, s = a.space / 1.5;\r
  if (w >= r && w >= s) return 'write';\r
  if (r >= w && r >= s) return 'read';\r
  return 'space';\r
}\r
`;export{e as default};