var e=`// Buddy memory allocator — the classic scheme the Linux kernel uses for its page allocator, and a lovely\r
// answer to "how does malloc hand out and reclaim memory without the free space rotting into confetti?" All\r
// blocks are powers of two. To satisfy a request you round it UP to the next power of two and hand out a block\r
// of that size; if you only have a bigger free block, you split it in half — repeatedly — until you reach the\r
// right size, and the two halves you create are "buddies." The magic is in freeing: when a block is released,\r
// you check whether its buddy (the other half it was split from) is also free; if so, you instantly coalesce\r
// the pair back into the parent block, and keep coalescing up the tree. Because a block of size S at offset A\r
// always has its buddy at exactly A XOR S, that check is one bit-flip and a lookup — no scanning. The payoff is\r
// fast (O(log n)) allocation and, crucially, aggressive de-fragmentation on free, so large contiguous blocks\r
// keep reappearing. The cost is INTERNAL fragmentation: ask for 33 units and you're given 64, wasting 31.\r
// Reference: Knuth, TAOCP vol. 1 (buddy system); the Linux page allocator.\r
\r
export interface Block { offset: number; size: number; order: number; state: 'free' | 'used' }\r
\r
export class Buddy {\r
  readonly total: number;      // total pool size (a power of two)\r
  readonly min: number;        // smallest allocatable block (a power of two)\r
  readonly maxOrder: number;   // order of the whole pool\r
  private freeLists: Set<number>[] = []; // freeLists[order] = set of free block offsets\r
  private used = new Map<number, number>(); // offset -> order of allocated blocks\r
\r
  constructor(total = 1024, min = 32) {\r
    this.total = total; this.min = min;\r
    this.maxOrder = Math.log2(total / min);\r
    for (let o = 0; o <= this.maxOrder; o++) this.freeLists[o] = new Set();\r
    this.freeLists[this.maxOrder].add(0); // one big free block covering the pool\r
  }\r
\r
  size(order: number): number { return this.min << order; }\r
  private orderFor(bytes: number): number { let o = 0; while (this.size(o) < bytes) o++; return o; }\r
  private take(order: number): number { const off = this.freeLists[order].values().next().value as number; this.freeLists[order].delete(off); return off; }\r
\r
  /** Allocate at least \`bytes\`; returns the block offset, or null if it can't be satisfied. */\r
  alloc(bytes: number): number | null {\r
    if (bytes <= 0 || bytes > this.total) return null;\r
    const need = this.orderFor(bytes);\r
    let o = need;\r
    while (o <= this.maxOrder && this.freeLists[o].size === 0) o++; // find the smallest available block that fits\r
    if (o > this.maxOrder) return null;                              // no block large enough\r
    while (o > need) {                                               // split down to the needed order\r
      const off = this.take(o);\r
      const half = this.size(o - 1);\r
      this.freeLists[o - 1].add(off);\r
      this.freeLists[o - 1].add(off + half);                        // the two buddies\r
      o--;\r
    }\r
    const off = this.take(need);\r
    this.used.set(off, need);\r
    return off;\r
  }\r
\r
  /** Free a previously allocated block; coalesces with its buddy up the tree. Returns false if not allocated. */\r
  release(offset: number): boolean {\r
    if (!this.used.has(offset)) return false;\r
    let o = this.used.get(offset)!;\r
    this.used.delete(offset);\r
    let off = offset;\r
    while (o < this.maxOrder) {\r
      const buddy = off ^ this.size(o);        // the buddy is one bit-flip away\r
      if (this.freeLists[o].has(buddy)) { this.freeLists[o].delete(buddy); off = Math.min(off, buddy); o++; } // merge\r
      else break;\r
    }\r
    this.freeLists[o].add(off);\r
    return true;\r
  }\r
\r
  /** A left-to-right layout of the current blocks (used and free), for rendering. */\r
  layout(): Block[] {\r
    const blocks: Block[] = [];\r
    for (const [offset, order] of this.used) blocks.push({ offset, size: this.size(order), order, state: 'used' });\r
    for (let o = 0; o <= this.maxOrder; o++) for (const offset of this.freeLists[o]) blocks.push({ offset, size: this.size(o), order: o, state: 'free' });\r
    return blocks.sort((a, b) => a.offset - b.offset);\r
  }\r
\r
  stats(): { used: number; free: number; largestFree: number; freeBlocks: number } {\r
    let used = 0; for (const order of this.used.values()) used += this.size(order);\r
    let largestFree = 0, freeBlocks = 0;\r
    for (let o = this.maxOrder; o >= 0; o--) { if (this.freeLists[o].size) { if (!largestFree) largestFree = this.size(o); freeBlocks += this.freeLists[o].size; } }\r
    return { used, free: this.total - used, largestFree, freeBlocks };\r
  }\r
}\r
`;export{e as default};