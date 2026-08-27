var e=`// The CPU cache — the small, fast SRAM that hides main memory's ~100 ns latency behind ~1–4 ns hits. It exploits\r
// LOCALITY: programs reuse the same addresses (temporal) and nearby ones (spatial). Memory moves in fixed BLOCKS\r
// (a cache line, typically 64 bytes), so touching one byte pulls in its whole line. The cache is organized as a\r
// grid of SETS, each holding a few WAYS (lines). A physical address is split into three fields: the low bits are\r
// the OFFSET within the line, the next bits are the SET INDEX (which row of the grid to look in), and the top\r
// bits are the TAG (which block, to disambiguate the lines that share a set). On access, the hardware jumps to\r
// the set the index names and compares the tag against every way in parallel: a match is a HIT (fast); no match\r
// is a MISS that fetches the line from memory and installs it, evicting the least-recently-used way if the set is\r
// full. Associativity is the key knob: a DIRECT-MAPPED cache (1 way) is fast and simple but two hot blocks that\r
// map to the same set evict each other forever (conflict misses); a FULLY-ASSOCIATIVE cache (1 set) never has\r
// conflicts but comparing every line is expensive; real caches sit in between (4–16 ways). This is the same\r
// address, decoded a second time: the DRAM section split it into bank/row/column; the cache splits it into\r
// tag/index/offset first. This models the decode, set-associative lookup, LRU eviction, and hit rate. Reference:\r
// Hennessy & Patterson, Computer Architecture (memory hierarchy).\r
\r
export interface Fields { tag: number; index: number; offset: number }\r
export interface AccessResult { hit: boolean; index: number; tag: number; offset: number; evictedTag: number | null }\r
\r
export class Cache {\r
  private sets: { tag: number; used: number }[][];\r
  private clock = 0;\r
  hits = 0; misses = 0;\r
  readonly offsetBits: number; readonly indexBits: number;\r
\r
  constructor(public blockBytes = 64, public numSets = 8, public ways = 2) {\r
    this.sets = Array.from({ length: numSets }, () => []);\r
    this.offsetBits = Math.log2(blockBytes);\r
    this.indexBits = Math.log2(numSets);\r
  }\r
\r
  decode(addr: number): Fields {\r
    const offset = addr & (this.blockBytes - 1);\r
    const index = Math.floor(addr / this.blockBytes) % this.numSets;\r
    const tag = Math.floor(addr / (this.blockBytes * this.numSets));\r
    return { tag, index, offset };\r
  }\r
\r
  access(addr: number): AccessResult {\r
    const { tag, index, offset } = this.decode(addr);\r
    const set = this.sets[index];\r
    const line = set.find((l) => l.tag === tag);\r
    if (line) { line.used = ++this.clock; this.hits++; return { hit: true, index, tag, offset, evictedTag: null }; }\r
    this.misses++;\r
    let evictedTag: number | null = null;\r
    if (set.length < this.ways) set.push({ tag, used: ++this.clock });\r
    else {\r
      const lru = set.reduce((a, b) => (a.used < b.used ? a : b)); // least-recently-used way\r
      evictedTag = lru.tag; lru.tag = tag; lru.used = ++this.clock;\r
    }\r
    return { hit: false, index, tag, offset, evictedTag };\r
  }\r
\r
  /** Current tags resident in a set (for display). */\r
  setContents(index: number): number[] { return this.sets[index].map((l) => l.tag); }\r
  hitRate(): number { const t = this.hits + this.misses; return t === 0 ? 0 : this.hits / t; }\r
  reset(): void { this.sets = Array.from({ length: this.numSets }, () => []); this.clock = 0; this.hits = 0; this.misses = 0; }\r
}\r
`;export{e as default};