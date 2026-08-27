var e=`// CAP theorem — when a network PARTITION splits your replicas, you can keep the\r
// system Consistent OR Available, but not both. Two replicas hold a value+version.\r
// With no partition a write propagates and both agree. Under a partition:\r
//   CP — only the primary side stays writable/readable; the minority side is made\r
//        UNAVAILABLE (errors) so clients never read stale data. Consistency over availability.\r
//   AP — both sides accept writes and DIVERGE; everyone stays available, and the\r
//        replicas reconcile on heal (last-writer-wins by version). Availability over consistency.\r
// You don't choose CAP freely — the partition forces the C-vs-A pick (PACELC notes\r
// that even without a partition you trade latency vs consistency). Pure, tested.\r
\r
export type Side = 'A' | 'B';\r
export type Mode = 'CP' | 'AP';\r
export type OpResult =\r
  | { ok: true; value: string; version: number }\r
  | { ok: false; error: string };\r
\r
export interface Replica { value: string; version: number }\r
\r
export class CapSystem {\r
  mode: Mode;\r
  partitioned = false;\r
  primary: Side = 'A'; // under CP, the writable side during a partition\r
  A: Replica;\r
  B: Replica;\r
\r
  constructor(mode: Mode, initial = '∅') {\r
    this.mode = mode;\r
    this.A = { value: initial, version: 0 };\r
    this.B = { value: initial, version: 0 };\r
  }\r
\r
  private rep(s: Side): Replica { return s === 'A' ? this.A : this.B; }\r
\r
  /** Is \`side\` available for ops right now? (Only CP makes the minority unavailable.) */\r
  available(side: Side): boolean {\r
    if (!this.partitioned) return true;\r
    if (this.mode === 'AP') return true; // AP: everyone stays up\r
    return side === this.primary; // CP: only the primary side serves\r
  }\r
\r
  write(side: Side, value: string): OpResult {\r
    if (!this.available(side)) return { ok: false, error: \`\${side} is unavailable (CP: minority side rejects writes during a partition)\` };\r
    const r = this.rep(side);\r
    r.value = value;\r
    r.version += 1;\r
    if (!this.partitioned) this.propagate(side); // healthy: replicate immediately\r
    return { ok: true, value: r.value, version: r.version };\r
  }\r
\r
  read(side: Side): OpResult {\r
    if (!this.available(side)) return { ok: false, error: \`\${side} is unavailable (CP refuses to serve possibly-stale reads)\` };\r
    const r = this.rep(side);\r
    return { ok: true, value: r.value, version: r.version };\r
  }\r
\r
  private propagate(from: Side): void {\r
    const src = this.rep(from), dst = this.rep(from === 'A' ? 'B' : 'A');\r
    dst.value = src.value;\r
    dst.version = src.version;\r
  }\r
\r
  /** True if the two replicas currently hold different values (AP divergence). */\r
  get diverged(): boolean { return this.A.value !== this.B.value; }\r
\r
  setPartitioned(p: boolean): void {\r
    this.partitioned = p;\r
    if (!p) this.reconcile(); // healing a partition triggers reconciliation\r
  }\r
\r
  /** On heal: last-writer-wins by version (higher version, then primary as tie-break). */\r
  reconcile(): { winner: Side; value: string; version: number } {\r
    let winner: Side;\r
    if (this.A.version > this.B.version) winner = 'A';\r
    else if (this.B.version > this.A.version) winner = 'B';\r
    else winner = this.primary;\r
    const w = this.rep(winner);\r
    const merged: Replica = { value: w.value, version: Math.max(this.A.version, this.B.version) };\r
    this.A = { ...merged };\r
    this.B = { ...merged };\r
    return { winner, value: merged.value, version: merged.version };\r
  }\r
}\r
`;export{e as default};