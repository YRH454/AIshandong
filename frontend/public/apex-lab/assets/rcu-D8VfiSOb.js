var e=`// RCU — Read-Copy-Update, the Linux kernel's trick for near-zero-cost reads of shared data. Readers take NO\r
// lock and never block: they just grab the current version and use it. A writer never mutates in place —\r
// it makes a private COPY, modifies the copy, then atomically swaps the published pointer to it (one pointer\r
// store). Any reader that was already traversing the OLD version keeps using it safely; readers arriving\r
// after the swap see the new one. The hard part is knowing when it's safe to FREE the old version: not until\r
// every reader that could still hold a reference to it has finished. That wait is the GRACE PERIOD — the old\r
// copy is reclaimed only once all pre-existing readers have passed through a "quiescent" state (here: unpinned\r
// it). Readers pay almost nothing; the writer pays the copy plus the grace-period wait. It's why RCU shines\r
// for read-mostly data (routing tables, config, the dcache). Reference: McKenney, Linux RCU.\r
\r
export interface Version { id: number; value: string; retired: boolean; reclaimed: boolean; refs: number }\r
\r
export class RCU {\r
  private versions: Version[] = [];\r
  private publishedId = 0;\r
  private nextId = 0;\r
  private nextReader = 0;\r
  private pins = new Map<number, number>(); // readerId -> version id it pinned\r
\r
  constructor(initial: string) {\r
    this.publishedId = this.mk(initial).id;\r
  }\r
  private mk(value: string): Version {\r
    const v: Version = { id: this.nextId++, value, retired: false, reclaimed: false, refs: 0 };\r
    this.versions.push(v);\r
    return v;\r
  }\r
  private ver(id: number): Version { return this.versions.find((v) => v.id === id)!; }\r
\r
  /** The version a new reader would see right now. */\r
  published(): Version { return this.ver(this.publishedId); }\r
\r
  /** A reader enters its read-side critical section: it pins whatever is published *now*. Never blocks. */\r
  readerPin(): number {\r
    const rid = this.nextReader++;\r
    const v = this.published();\r
    v.refs++;\r
    this.pins.set(rid, v.id);\r
    return rid;\r
  }\r
  /** What a pinned reader sees — always its own consistent snapshot (old or new, never torn or freed). */\r
  read(readerId: number): string {\r
    const vid = this.pins.get(readerId);\r
    if (vid === undefined) throw new Error('reader not pinned');\r
    const v = this.ver(vid);\r
    if (v.reclaimed) throw new Error('use-after-free: reader read a reclaimed version'); // must never happen\r
    return v.value;\r
  }\r
  /** Reader leaves its critical section (a quiescent state). May end a grace period → reclaim the old copy. */\r
  readerUnpin(readerId: number): void {\r
    const vid = this.pins.get(readerId);\r
    if (vid === undefined) return;\r
    const v = this.ver(vid);\r
    v.refs--;\r
    this.pins.delete(readerId);\r
    this.tryReclaim(v);\r
  }\r
\r
  /** Writer: copy the current value, modify the copy, atomically publish it, retire the old one. */\r
  update(mutate: (old: string) => string): void {\r
    const old = this.published();\r
    const nv = this.mk(mutate(old.value));\r
    this.publishedId = nv.id; // the atomic pointer swap — the instant readers start seeing the new version\r
    old.retired = true;\r
    this.tryReclaim(old); // may already be free if nobody was reading it\r
  }\r
\r
  /** Reclaim a retired version once no reader still references it (grace period complete). */\r
  private tryReclaim(v: Version): void {\r
    if (v.retired && v.refs === 0 && v.id !== this.publishedId) v.reclaimed = true;\r
  }\r
\r
  /** Versions still occupying memory (published + retired-but-not-yet-reclaimed). */\r
  liveVersions(): Version[] { return this.versions.filter((v) => !v.reclaimed); }\r
  /** Every version ever created (incl. reclaimed) — for visualizing the lifecycle. */\r
  allVersions(): Version[] { return this.versions.map((v) => ({ ...v })); }\r
  publishedId_(): number { return this.publishedId; }\r
  activeReaders(): { readerId: number; versionId: number }[] {\r
    return [...this.pins.entries()].map(([readerId, versionId]) => ({ readerId, versionId }));\r
  }\r
}\r
`;export{e as default};