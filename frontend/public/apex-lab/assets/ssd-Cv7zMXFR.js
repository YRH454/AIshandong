var e=`// How an SSD works — and why it's so different from a disk. Flash stores a bit as trapped charge on a\r
// floating-gate transistor; no moving parts, so reads are fast and uniform. The twist is a hard physical\r
// asymmetry in what you can do to it. The unit you READ and WRITE (program) is a PAGE (a few KB). But the unit\r
// you ERASE is a whole BLOCK (hundreds of pages). And a page can't be overwritten in place — flash programming\r
// only flips bits one way, so to change a page you must first erase its entire block back to blank. Erasing is\r
// slow and, worse, each cell physically wears out after a limited number of program/erase cycles. Overwriting\r
// data in place would erase-and-rewrite a huge block for every small write and burn out hot cells fast. So every\r
// SSD hides a FLASH TRANSLATION LAYER (FTL): the drive lies about where data is. A logical block address maps to\r
// some physical page, and a "write" never overwrites — it programs a FRESH page, repoints the map, and marks the\r
// old page STALE. When free pages run low, GARBAGE COLLECTION picks a block, copies its few still-valid pages\r
// elsewhere, and erases the block to reclaim the stale space. That copying means one logical write can cause\r
// several physical writes — WRITE AMPLIFICATION — and the FTL spreads erases across all blocks (WEAR LEVELING) so\r
// no cell dies early. This models the FTL: out-of-place writes, page states, garbage collection, write\r
// amplification, and erase wear. Reference: flash datasheets; Agrawal et al., "Design Tradeoffs for SSD\r
// Performance" (2008).\r
\r
export type PageState = 'free' | 'valid' | 'stale';\r
export interface Page { state: PageState; lpn: number } // lpn = which logical block lives here (-1 if none)\r
\r
export class Ssd {\r
  blocks: Page[][];\r
  erases: number[];\r
  readonly capacity: number;                 // logical pages the drive exposes (< physical: over-provisioning)\r
  private map = new Map<number, number>(); // logical page number → physical page index\r
  logicalWrites = 0;\r
  physicalWrites = 0;\r
\r
  constructor(public numBlocks = 8, public pagesPerBlock = 8) {\r
    this.blocks = Array.from({ length: numBlocks }, () => Array.from({ length: pagesPerBlock }, () => ({ state: 'free' as PageState, lpn: -1 })));\r
    this.erases = new Array(numBlocks).fill(0);\r
    this.capacity = (numBlocks - 1) * pagesPerBlock; // reserve one block of spare space so GC can always relocate\r
  }\r
\r
  private pageAt(idx: number): Page { return this.blocks[Math.floor(idx / this.pagesPerBlock)][idx % this.pagesPerBlock]; }\r
  private freePages(): number { let n = 0; for (const b of this.blocks) for (const p of b) if (p.state === 'free') n++; return n; }\r
  private findFree(): number { for (let i = 0; i < this.numBlocks * this.pagesPerBlock; i++) if (this.pageAt(i).state === 'free') return i; return -1; }\r
  private stateCount(block: number, state: PageState): number { let n = 0; for (const p of this.blocks[block]) if (p.state === state) n++; return n; }\r
\r
  /** Write a logical page: program a fresh physical page out-of-place, stale the old, GC when space runs low.\r
   *  A brand-new logical page is rejected once the drive is at its (over-provisioned) capacity. */\r
  write(lpn: number): void {\r
    this.logicalWrites++;\r
    if (!this.map.has(lpn) && this.map.size >= this.capacity) return; // drive full — spare capacity is reserved for GC\r
    let guard = 0;\r
    while (this.freePages() <= this.pagesPerBlock && guard++ <= this.numBlocks) if (!this.gc()) break; // reclaim while GC can progress\r
    const idx = this.findFree();\r
    if (idx < 0) return;                       // no free page (spare guarantees this shouldn't happen) — drop, never lose data\r
    const old = this.map.get(lpn);\r
    if (old !== undefined) this.pageAt(old).state = 'stale';\r
    const pg = this.pageAt(idx); pg.state = 'valid'; pg.lpn = lpn;\r
    this.map.set(lpn, idx); this.physicalWrites++;\r
  }\r
\r
  read(lpn: number): number | null { const idx = this.map.get(lpn); return idx === undefined ? null : idx; }\r
\r
  /** Garbage-collect: erase the most-stale block whose valid pages FIT in the free space elsewhere (so nothing is\r
   *  ever lost). Relocate its valid pages first, then erase. Returns true if it reclaimed a block. */\r
  gc(): boolean {\r
    const totalFree = this.freePages();\r
    let best = -1, bestStale = 0;\r
    for (let b = 0; b < this.numBlocks; b++) {\r
      const stale = this.stateCount(b, 'stale');\r
      if (stale === 0) continue;                                   // nothing to reclaim here\r
      const valid = this.stateCount(b, 'valid');\r
      if (totalFree - this.stateCount(b, 'free') < valid) continue; // can't relocate all valid pages safely → skip\r
      if (stale > bestStale || (stale === bestStale && best >= 0 && this.erases[b] < this.erases[best])) { best = b; bestStale = stale; }\r
    }\r
    if (best < 0) return false;                                    // no block is safe to reclaim right now\r
    for (let p = 0; p < this.pagesPerBlock; p++) {\r
      const pg = this.blocks[best][p];\r
      if (pg.state === 'valid') { const dst = this.findFreeExcluding(best); const d = this.pageAt(dst); d.state = 'valid'; d.lpn = pg.lpn; this.map.set(pg.lpn, dst); this.physicalWrites++; }\r
    }\r
    for (const pg of this.blocks[best]) { pg.state = 'free'; pg.lpn = -1; } // erase (all valid pages are safely relocated)\r
    this.erases[best]++;\r
    return true;\r
  }\r
  private findFreeExcluding(block: number): number {\r
    for (let i = 0; i < this.numBlocks * this.pagesPerBlock; i++) if (Math.floor(i / this.pagesPerBlock) !== block && this.pageAt(i).state === 'free') return i;\r
    return -1;\r
  }\r
\r
  writeAmplification(): number { return this.logicalWrites === 0 ? 1 : this.physicalWrites / this.logicalWrites; }\r
  counts(): { free: number; valid: number; stale: number } {\r
    let free = 0, valid = 0, stale = 0;\r
    for (const b of this.blocks) for (const p of b) p.state === 'free' ? free++ : p.state === 'valid' ? valid++ : stale++;\r
    return { free, valid, stale };\r
  }\r
}\r
`;export{e as default};