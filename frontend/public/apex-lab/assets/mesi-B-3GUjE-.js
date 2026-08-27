var e=`// MESI cache coherence — how N cores keep private caches of the SAME memory line consistent without\r
// ever reading stale data. Each core's copy of a line is in one of four states: Modified (dirty, sole\r
// owner), Exclusive (clean, sole owner), Shared (clean, maybe others have it), Invalid (don't have it).\r
// A core's own load/store plus the bus transactions it SNOOPS from other cores drive the transitions.\r
// The invariant that makes it correct: a line is in M or E in at most one cache at a time, and an M\r
// copy must be written back before anyone else reads it. Write-invalidate, write-back, snooping bus.\r
// Reference: Hennessy & Patterson, Computer Architecture (the MESI / snooping-coherence chapter);\r
// Papamarcos & Patel 1984. Transitions are enumerable and exactly testable (see tests).\r
\r
export type State = 'M' | 'E' | 'S' | 'I';\r
export type Op = 'read' | 'write';\r
export type Bus = 'BusRd' | 'BusRdX' | 'BusUpgr' | null;\r
\r
export interface Step {\r
  states: State[];   // per-core state AFTER the operation\r
  bus: Bus;          // bus transaction issued (null = satisfied locally, no bus traffic)\r
  flush: boolean;    // did a dirty (M) owner have to write back / supply the data?\r
  hit: boolean;      // was it a cache hit (no state change, no bus)?\r
  note: string;\r
}\r
\r
export const STATE_NAME: Record<State, string> = { M: 'Modified', E: 'Exclusive', S: 'Shared', I: 'Invalid' };\r
\r
/** Apply \`op\` by \`core\` to the shared line, returning the new states and the bus/flush effects. */\r
export function step(states: State[], core: number, op: Op): Step {\r
  const next = [...states];\r
  const others = states.map((_, i) => i).filter((i) => i !== core);\r
  const someoneElseHas = others.some((i) => states[i] !== 'I');\r
  const cur = states[core];\r
\r
  if (op === 'read') {\r
    if (cur !== 'I') return { states: next, bus: null, flush: false, hit: true, note: \`read hit in \${cur} — no bus traffic\` };\r
    // read miss → BusRd. M/E owners drop to S (an M owner flushes); the reader becomes E if it is the\r
    // sole holder, otherwise S.\r
    const flush = others.some((i) => states[i] === 'M');\r
    for (const i of others) if (states[i] === 'M' || states[i] === 'E' || states[i] === 'S') next[i] = 'S';\r
    next[core] = someoneElseHas ? 'S' : 'E';\r
    return { states: next, bus: 'BusRd', flush, hit: false, note: someoneElseHas ? 'read miss — shared by others → S' : 'read miss — no other copy → E (exclusive)' };\r
  }\r
\r
  // write\r
  if (cur === 'M') return { states: next, bus: null, flush: false, hit: true, note: 'write hit in M — no bus traffic' };\r
  if (cur === 'E') { next[core] = 'M'; return { states: next, bus: null, flush: false, hit: true, note: 'write hit — silent E→M upgrade (we already own it exclusively)' }; }\r
  if (cur === 'S') {\r
    for (const i of others) next[i] = 'I';\r
    next[core] = 'M';\r
    return { states: next, bus: 'BusUpgr', flush: false, hit: false, note: 'write to a Shared line → BusUpgr invalidates the other copies, then S→M' };\r
  }\r
  // cur === 'I' → write miss, read-for-ownership\r
  const flush = others.some((i) => states[i] === 'M');\r
  for (const i of others) next[i] = 'I';\r
  next[core] = 'M';\r
  return { states: next, bus: 'BusRdX', flush, hit: false, note: 'write miss → BusRdX fetches the line and invalidates every other copy, then →M' };\r
}\r
\r
/** The coherence invariant: never two writers, and M/E is unique. Returns true iff \`states\` is legal. */\r
export function coherent(states: State[]): boolean {\r
  const owners = states.filter((s) => s === 'M' || s === 'E').length;\r
  if (owners > 1) return false;                       // at most one M or E copy\r
  if (owners === 1 && states.some((s) => s === 'S')) return false; // M/E excludes any S copy\r
  return true;\r
}\r
`;export{e as default};