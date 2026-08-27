var e=`// Copy-on-write fork — why fork() is cheap even for a process using gigabytes of memory. Instead of\r
// duplicating every page up front, fork makes the child's page tables point at the SAME physical frames\r
// as the parent, marked read-only, and just bumps each frame's reference count. Both processes read the\r
// shared pages happily. Only when one of them WRITES does the kernel trap, allocate a fresh frame, copy\r
// that single page, and repoint the writer's entry — so you pay for exactly the pages that actually get\r
// modified, lazily. If the child immediately exec()s (replacing its whole address space), almost nothing\r
// was ever copied. This is what makes fork+exec, forking web servers, and snapshotting fast. Reference:\r
// the Unix fork/COW mechanism; OSTEP ch.5 / the VM chapters.\r
\r
export type Proc = 'parent' | 'child';\r
export interface PageView { index: number; frame: number; shared: boolean; refcount: number }\r
export interface CowState { copies: number; parent: number[]; child: number[] | null; refcount: Record<number, number> }\r
\r
export class CowMemory {\r
  private nextFrame: number;\r
  private refcount: Record<number, number> = {};\r
  private parent: number[];          // parent's page table: page index → frame id\r
  private child: number[] | null = null;\r
  copies = 0;                        // physical frames allocated due to a COW fault\r
\r
  constructor(pages: number) {\r
    this.parent = Array.from({ length: pages }, (_, i) => i);\r
    for (let i = 0; i < pages; i++) this.refcount[i] = 1;\r
    this.nextFrame = pages;\r
  }\r
\r
  /** fork(): the child shares every parent frame read-only; no data is copied (just refcount bumps). */\r
  fork() {\r
    this.child = [...this.parent];\r
    for (const f of this.parent) this.refcount[f]++;\r
  }\r
\r
  private table(p: Proc) { return p === 'parent' ? this.parent : this.child!; }\r
\r
  /** A write by \`p\` to page \`i\`: if the frame is shared, fault → allocate + copy + repoint; else write in place. */\r
  write(p: Proc, i: number) {\r
    const tbl = this.table(p);\r
    const frame = tbl[i];\r
    if (this.refcount[frame] > 1) {           // shared → copy-on-write fault\r
      const fresh = this.nextFrame++;\r
      this.refcount[frame]--;\r
      this.refcount[fresh] = 1;\r
      tbl[i] = fresh;\r
      this.copies++;\r
    }\r
    // else: already private (refcount 1) → write in place, no copy\r
  }\r
\r
  /** exec(): the child replaces its whole address space — its shared frames are dropped, nothing copied. */\r
  execChild() {\r
    if (!this.child) return;\r
    for (const f of this.child) this.refcount[f]--;\r
    this.child = Array.from({ length: this.parent.length }, () => -1); // brand-new (unmapped here) space\r
  }\r
\r
  view(p: Proc): PageView[] {\r
    const tbl = this.table(p);\r
    return tbl.map((frame, index) => ({ index, frame, shared: frame >= 0 && this.refcount[frame] > 1, refcount: frame >= 0 ? this.refcount[frame] : 0 }));\r
  }\r
  state(): CowState { return { copies: this.copies, parent: [...this.parent], child: this.child ? [...this.child] : null, refcount: { ...this.refcount } }; }\r
}\r
`;export{e as default};