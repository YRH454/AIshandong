var e=`// The seqlock (sequence lock) — a reader/writer synchronization trick for data that is read constantly but\r
// written rarely, where you refuse to make readers pay. The classic user is the kernel clock: gettimeofday() is\r
// called millions of times a second and must be fast and never block, but the time value is a multi-word struct\r
// (seconds + nanoseconds) updated by a timer interrupt. A plain lock would serialize every reader; a plain read\r
// risks a TORN read — seeing the seconds from before an update and the nanoseconds from after. A seqlock solves\r
// it with a single counter and no reader locking. The writer bumps a sequence counter to an ODD value before it\r
// starts writing and to the next EVEN value when it's done. A reader snapshots the counter, reads the data, then\r
// re-reads the counter: if it was odd (a write was in progress) or it changed (a write happened during the\r
// read), the reader saw a possibly-torn value and simply RETRIES from the top. Readers never block and never\r
// take a lock — they just occasionally loop — so reads are almost free, at the cost that a read racing a write\r
// does a little wasted work. The tradeoff is deliberately asymmetric: writers are (lightly) serialized among\r
// themselves and readers are optimistic. The catch is that the data must be safe to read while being written\r
// (no pointer chasing that could fault, hence its use for POD structs), and you need the right memory barriers so\r
// the counter checks aren't reordered around the data reads. This models the writer's odd/even protocol and the\r
// reader's snapshot-read-recheck, and EXHAUSTIVELY proves across every interleaving that the seqlock reader never\r
// accepts a torn value while a naive lockless reader sometimes does. Reference: Lameter, "Effective\r
// Synchronization on Linux/NUMA"; the Linux kernel seqlock_t / seqcount.\r
\r
export interface State { seq: number; a: number; b: number } // invariant while consistent: a === b (same generation)\r
export interface Ev { actor: 'W' | 'R'; label: string }\r
interface WEv extends Ev { apply: (s: State) => State }\r
interface REv extends Ev { field: 'seq' | 'a' | 'b'; into: 's1' | 'ra' | 'rb' | 's2' }\r
\r
/** Writer transaction: raise the data from generation g to g+1, bracketed by odd/even counter bumps. */\r
export function writerOps(g: number): WEv[] {\r
  return [\r
    { actor: 'W', label: 'seq++ (→odd)', apply: (s) => ({ ...s, seq: s.seq + 1 }) },\r
    { actor: 'W', label: \`a = \${g + 1}\`, apply: (s) => ({ ...s, a: g + 1 }) },\r
    { actor: 'W', label: \`b = \${g + 1}\`, apply: (s) => ({ ...s, b: g + 1 }) },\r
    { actor: 'W', label: 'seq++ (→even)', apply: (s) => ({ ...s, seq: s.seq + 1 }) },\r
  ];\r
}\r
export const readerOps = (): REv[] => [\r
  { actor: 'R', label: 'read seq → s1', field: 'seq', into: 's1' },\r
  { actor: 'R', label: 'read a → ra', field: 'a', into: 'ra' },\r
  { actor: 'R', label: 'read b → rb', field: 'b', into: 'rb' },\r
  { actor: 'R', label: 'read seq → s2', field: 'seq', into: 's2' },\r
];\r
\r
export interface Regs { s1: number; ra: number; rb: number; s2: number }\r
export type Outcome = { kind: 'ok'; a: number; b: number } | { kind: 'torn'; a: number; b: number } | { kind: 'retry' };\r
\r
/** Execute one interleaving of the writer and reader ops over an initial state; capture the reader's registers. */\r
export function execute(order: Ev[], init: State): { regs: Regs; final: State } {\r
  let s = { ...init };\r
  const regs: Regs = { s1: 0, ra: 0, rb: 0, s2: 0 };\r
  for (const ev of order) {\r
    if (ev.actor === 'W') s = (ev as WEv).apply(s);\r
    else { const r = ev as REv; regs[r.into] = s[r.field]; }\r
  }\r
  return { regs, final: s };\r
}\r
\r
/** The seqlock reader accepts only if the counter was even and unchanged; otherwise it retries. */\r
export function seqlockOutcome(r: Regs): Outcome {\r
  if (r.s1 % 2 === 1) return { kind: 'retry' };   // a write was already in progress\r
  if (r.s1 !== r.s2) return { kind: 'retry' };    // a write happened during the read\r
  return { kind: 'ok', a: r.ra, b: r.rb };        // even + unchanged ⇒ consistent snapshot\r
}\r
\r
/** A naive lockless reader takes whatever it read — torn if the two fields disagree. */\r
export function naiveOutcome(r: Regs): Outcome {\r
  return r.ra === r.rb ? { kind: 'ok', a: r.ra, b: r.rb } : { kind: 'torn', a: r.ra, b: r.rb };\r
}\r
\r
/** All order-preserving interleavings (merges) of two op lists. */\r
export function interleavings(w: Ev[], r: Ev[]): Ev[][] {\r
  if (w.length === 0) return [r.slice()];\r
  if (r.length === 0) return [w.slice()];\r
  return [\r
    ...interleavings(w.slice(1), r).map((m) => [w[0], ...m]),\r
    ...interleavings(w, r.slice(1)).map((m) => [r[0], ...m]),\r
  ];\r
}\r
`;export{e as default};