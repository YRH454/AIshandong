var e=`// Robin Hood hashing — an open-addressing hash table with one elegant tweak that dramatically improves the\r
// worst case. In plain linear probing, a key hashes to a "home" slot and, if it's taken, walks forward to the\r
// next empty one; the number of steps is its "probe distance." The problem is variance: some keys sit right at\r
// home (distance 0) while unlucky ones in a cluster probe far, so the WORST-case lookup is long even though the\r
// average is fine. Robin Hood adds a fairness rule during insertion: as you probe, compare your probe distance\r
// so far with the distance of the element already sitting in each slot. If that element is RICHER than you —\r
// closer to its own home than you are to yours — you evict it, take its slot, and carry the evicted element\r
// onward to find a new home. You "rob from the rich (low distance) to give to the poor (high distance)." The\r
// effect is that all probe distances get equalized: no key ends up much worse off than any other, so the\r
// maximum probe distance stays tiny (O(log n) w.h.p. instead of much larger) and lookups have low, predictable\r
// latency. It also enables a neat early-exit on lookups — if you've probed farther than the element currently in\r
// the slot, your key can't be here, because Robin Hood would have placed it earlier. This models insertion with\r
// the swap rule, backward-shift deletion, and the probe-distance distribution versus plain linear probing.\r
// Reference: Celis, "Robin Hood Hashing" (1986); used in Rust's old std HashMap, and many high-performance ones.\r
\r
export interface Slot { key: string; home: number }\r
\r
function hashKey(key: string, cap: number): number {\r
  let h = 2166136261 >>> 0;\r
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }\r
  return (h >>> 0) % cap;\r
}\r
\r
export class RobinHood {\r
  readonly cap: number;\r
  slots: (Slot | null)[];\r
  size = 0;\r
\r
  constructor(cap: number) { this.cap = cap; this.slots = new Array(cap).fill(null); }\r
\r
  private dist(slot: number, home: number): number { return (slot - home + this.cap) % this.cap; }\r
\r
  /** Insert a key with the Robin Hood swap rule. No-op if already present; false if the table is full of new keys. */\r
  insert(key: string): boolean {\r
    if (this.lookup(key) >= 0) return true;                       // already present (set semantics), no swaps\r
    if (this.size >= this.cap) return false;                      // full, and this key is new\r
    let cur: Slot = { key, home: hashKey(key, this.cap) };\r
    let slot = cur.home, d = 0;\r
    for (;;) {                                                    // size < cap ⇒ an empty slot exists\r
      const occ = this.slots[slot];\r
      if (occ === null) { this.slots[slot] = cur; this.size++; return true; }\r
      const existingDist = this.dist(slot, occ.home);\r
      if (existingDist < d) { this.slots[slot] = cur; cur = occ; d = existingDist; } // rob the richer element\r
      slot = (slot + 1) % this.cap; d++;\r
    }\r
  }\r
\r
  /** Look up a key; returns its slot index or -1. Exits early once we've out-probed the resident element. */\r
  lookup(key: string): number {\r
    let slot = hashKey(key, this.cap), d = 0;\r
    for (let steps = 0; steps < this.cap; steps++) {\r
      const occ = this.slots[slot];\r
      if (occ === null) return -1;\r
      if (occ.key === key) return slot;\r
      if (this.dist(slot, occ.home) < d) return -1;               // Robin Hood early termination\r
      slot = (slot + 1) % this.cap; d++;\r
    }\r
    return -1;\r
  }\r
\r
  /** Delete a key using backward-shift: pull following displaced elements back toward home. */\r
  delete(key: string): boolean {\r
    const at = this.lookup(key);\r
    if (at < 0) return false;\r
    let i = at, next = (i + 1) % this.cap;\r
    while (this.slots[next] !== null && this.dist(next, this.slots[next]!.home) > 0) {\r
      this.slots[i] = this.slots[next]; i = next; next = (i + 1) % this.cap;\r
    }\r
    this.slots[i] = null; this.size--;\r
    return true;\r
  }\r
\r
  /** Probe distance of every occupied slot, plus max/mean/variance. */\r
  probeStats(): { distances: number[]; max: number; mean: number; variance: number } {\r
    const distances: number[] = [];\r
    for (let i = 0; i < this.cap; i++) if (this.slots[i]) distances.push(this.dist(i, this.slots[i]!.home));\r
    const n = distances.length || 1;\r
    const mean = distances.reduce((a, b) => a + b, 0) / n;\r
    const variance = distances.reduce((a, b) => a + (b - mean) ** 2, 0) / n;\r
    return { distances, max: distances.length ? Math.max(...distances) : 0, mean, variance };\r
  }\r
}\r
\r
/** Plain linear probing (no swaps) — for comparison. Returns each occupied slot's probe distance. */\r
export function plainLinearProbe(keys: string[], cap: number): { max: number; variance: number } {\r
  const slots: (Slot | null)[] = new Array(cap).fill(null);\r
  let used = 0;\r
  for (const key of keys) {\r
    if (used >= cap) break;                              // table full — stop (no infinite probe)\r
    const home = hashKey(key, cap); let slot = home;\r
    for (let step = 0; step < cap; step++) {\r
      if (slots[slot] === null) { slots[slot] = { key, home }; used++; break; }\r
      if (slots[slot]!.key === key) break;               // duplicate — no-op\r
      slot = (slot + 1) % cap;\r
    }\r
  }\r
  const dists: number[] = [];\r
  for (let i = 0; i < cap; i++) if (slots[i]) dists.push((i - slots[i]!.home + cap) % cap);\r
  const n = dists.length || 1, mean = dists.reduce((a, b) => a + b, 0) / n;\r
  return { max: dists.length ? Math.max(...dists) : 0, variance: dists.reduce((a, b) => a + (b - mean) ** 2, 0) / n };\r
}\r
`;export{e as default};