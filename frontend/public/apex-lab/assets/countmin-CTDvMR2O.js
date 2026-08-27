var e=`// Count-Min Sketch (Cormode & Muthukrishnan, 2005) — count how often each item appears\r
// in a huge stream using a tiny fixed amount of memory, by accepting a one-sided error.\r
// A d×w grid of counters; each item is hashed by d independent functions to one cell per\r
// row, and adding the item bumps those d cells. To estimate its count, take the MINIMUM\r
// of its d cells — collisions only ever ADD to a counter, so the minimum is the cell\r
// least polluted by other items. The estimate is therefore never an underestimate; it can\r
// overestimate, and more rows/columns shrink that error. Pure and tested.\r
\r
export interface Sketch { d: number; w: number; table: number[][]; seeds: number[] }\r
\r
const SEEDS = [0x9e3779b1, 0x85ebca77, 0xc2b2ae3d, 0x27d4eb2f, 0x165667b1, 0xd3a2646c];\r
\r
/** A small deterministic string hash seeded per row. */\r
function hashWith(s: string, seed: number, w: number): number {\r
  let h = seed >>> 0;\r
  for (let i = 0; i < s.length; i++) {\r
    h ^= s.charCodeAt(i);\r
    h = Math.imul(h, 0x01000193) >>> 0; // FNV-style mix\r
  }\r
  return h % w;\r
}\r
\r
export function create(d: number, w: number): Sketch {\r
  return { d, w, table: Array.from({ length: d }, () => new Array(w).fill(0)), seeds: SEEDS.slice(0, d) };\r
}\r
\r
/** The d cell columns an item maps to (one per row). */\r
export const cells = (s: Sketch, item: string): number[] => s.seeds.map((seed) => hashWith(item, seed, s.w));\r
\r
export function add(s: Sketch, item: string, count = 1): void {\r
  cells(s, item).forEach((col, row) => { s.table[row][col] += count; });\r
}\r
\r
/** Estimated count = the minimum across the item's d cells (never an underestimate). */\r
export function estimate(s: Sketch, item: string): number {\r
  return Math.min(...cells(s, item).map((col, row) => s.table[row][col]));\r
}\r
\r
/** Build a sketch from a stream and also return the exact counts, for comparison. */\r
export function fromStream(d: number, w: number, stream: string[]): { sketch: Sketch; truth: Map<string, number> } {\r
  const sketch = create(d, w);\r
  const truth = new Map<string, number>();\r
  for (const x of stream) { add(sketch, x); truth.set(x, (truth.get(x) ?? 0) + 1); }\r
  return { sketch, truth };\r
}\r
`;export{e as default};