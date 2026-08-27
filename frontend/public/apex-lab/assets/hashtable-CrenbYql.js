var e=`// Hash tables and collision resolution — the everyday structure behind dictionaries, sets,
// and database indexes, and the two classic ways to handle the inevitable collisions when
// two keys hash to the same slot. SEPARATE CHAINING hangs a little list off each slot, so
// colliding keys coexist; lookups scan the chain. OPEN ADDRESSING (linear probing) keeps
// everything in the flat array and, on a collision, walks forward to the next free slot;
// lookups probe the same way. Chaining tolerates high load gracefully; probing is more
// cache-friendly but degrades sharply as the table fills (clustering). Pure, tested.

function hash(key: string, m: number): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 0) % m;
}

// ── Separate chaining ──
export interface Chained { m: number; buckets: string[][] }
export const createChained = (m: number): Chained => ({ m, buckets: Array.from({ length: m }, () => []) });

export function chainInsert(t: Chained, key: string): { slot: number } {
  const slot = hash(key, t.m);
  if (!t.buckets[slot].includes(key)) t.buckets[slot].push(key);
  return { slot };
}
export function chainLookup(t: Chained, key: string): { slot: number; found: boolean; probes: number } {
  const slot = hash(key, t.m);
  const idx = t.buckets[slot].indexOf(key);
  return { slot, found: idx >= 0, probes: idx >= 0 ? idx + 1 : t.buckets[slot].length };
}
export function chainRemove(t: Chained, key: string): boolean {
  const bucket = t.buckets[hash(key, t.m)];
  const idx = bucket.indexOf(key);
  if (idx < 0) return false;
  bucket.splice(idx, 1); // chaining: just drop it from the list
  return true;
}

// ── Open addressing (linear probing) ──
export interface Probed { m: number; slots: (string | null)[] }
export const createProbed = (m: number): Probed => ({ m, slots: new Array(m).fill(null) });

// A deleted open-addressing slot becomes a TOMBSTONE, not null: a null would falsely terminate the
// probe sequence of any key that had to skip past this slot, orphaning it. Tombstones keep the chain
// walkable while still being reusable by a later insert.
const TOMB = '\0__deleted__\0';

export interface ProbeInsert { ok: boolean; slot: number; probeSeq: number[] }
export function probeInsert(t: Probed, key: string): ProbeInsert {
  const start = hash(key, t.m);
  const probeSeq: number[] = [];
  let firstFree = -1; // first reusable tombstone we passed
  for (let i = 0; i < t.m; i++) {
    const s = (start + i) % t.m;
    probeSeq.push(s);
    if (t.slots[s] === key) return { ok: true, slot: s, probeSeq }; // already present
    if (t.slots[s] === TOMB) { if (firstFree < 0) firstFree = s; continue; } // reusable, but keep scanning for the key
    if (t.slots[s] === null) { const slot = firstFree >= 0 ? firstFree : s; t.slots[slot] = key; return { ok: true, slot, probeSeq }; }
  }
  if (firstFree >= 0) { t.slots[firstFree] = key; return { ok: true, slot: firstFree, probeSeq }; } // full of live+tombstones
  return { ok: false, slot: -1, probeSeq }; // table full
}
export function probeLookup(t: Probed, key: string): { found: boolean; slot: number; probes: number } {
  const start = hash(key, t.m);
  for (let i = 0; i < t.m; i++) {
    const s = (start + i) % t.m;
    if (t.slots[s] === null) return { found: false, slot: -1, probes: i + 1 }; // truly empty → not present
    if (t.slots[s] === key) return { found: true, slot: s, probes: i + 1 };
    // a TOMBSTONE is neither → keep probing past it
  }
  return { found: false, slot: -1, probes: t.m };
}
/** Delete by tombstoning the slot (so probe chains through it stay intact). */
export function probeRemove(t: Probed, key: string): boolean {
  const start = hash(key, t.m);
  for (let i = 0; i < t.m; i++) {
    const s = (start + i) % t.m;
    if (t.slots[s] === null) return false; // not present
    if (t.slots[s] === key) { t.slots[s] = TOMB; return true; } // tombstone, NOT null
  }
  return false;
}

export const loadFactor = (t: Probed): number => t.slots.filter((s) => s !== null && s !== TOMB).length / t.m;
export { hash as slotOf };
`;export{e as default};