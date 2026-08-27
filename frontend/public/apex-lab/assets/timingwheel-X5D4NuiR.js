var e=`// Timing wheel — how systems that juggle huge numbers of timers (the Linux kernel, Kafka, Netty, Akka) schedule\r
// them in O(1) instead of O(log n). The naive way to manage timers is a min-heap keyed by expiry: insert and\r
// remove-min are O(log n), which hurts when you have millions of short-lived timers (every network connection\r
// wants a keepalive and a timeout). A timing wheel is a circular array of buckets, like the numbers on a clock\r
// face, plus a hand that advances one bucket per "tick." To schedule a timer that should fire in d ticks, you\r
// don't search or sort — you just drop it into the bucket the hand will reach in d ticks: bucket =\r
// (current + d) mod N. Every tick, the hand moves to the next bucket and fires whatever timers live there. That\r
// makes insert, cancel, and per-tick expiry all O(1). The catch is delays longer than one full revolution\r
// (d ≥ N): the "hashed" timing wheel handles them by also storing a ROUNDS counter — how many more full laps\r
// before this timer is due — and decrementing it each time the hand passes, firing only when it hits zero.\r
// (Hierarchical wheels instead cascade into coarser wheels — seconds → minutes → hours — like a mechanical\r
// clock's gears.) This models a single hashed wheel. Reference: Varghese & Lauck, "Hashed and Hierarchical\r
// Timing Wheels" (1987); the Kafka/Netty timer implementations.\r
\r
export interface Timer { id: string; rounds: number; fireAt: number; delay: number }\r
\r
export class TimingWheel {\r
  readonly n: number;      // number of buckets\r
  current = 0;             // the bucket the hand points at\r
  time = 0;                // absolute ticks elapsed\r
  slots: Timer[][];\r
\r
  constructor(n: number) { this.n = n; this.slots = Array.from({ length: n }, () => []); }\r
\r
  /** Schedule a timer to fire in \`delay\` ticks (>=1). Returns which bucket and how many rounds it needs. */\r
  add(id: string, delay: number): Timer {\r
    const d = Math.max(1, Math.floor(delay));\r
    const bucket = (this.current + d) % this.n;\r
    const rounds = Math.floor((d - 1) / this.n);   // extra full laps before it's due\r
    const t: Timer = { id, rounds, fireAt: this.time + d, delay: d };\r
    this.slots[bucket].push(t);\r
    return t;\r
  }\r
\r
  /** Cancel a scheduled timer by id. O(bucket size) at most; O(1) amortized with a back-index in practice. */\r
  cancel(id: string): boolean {\r
    for (const bucket of this.slots) {\r
      const i = bucket.findIndex((t) => t.id === id);\r
      if (i >= 0) { bucket.splice(i, 1); return true; }\r
    }\r
    return false;\r
  }\r
\r
  /** Advance the hand one tick; fire (and remove) the timers in the new bucket whose rounds have run out. */\r
  tick(): Timer[] {\r
    this.time++;\r
    this.current = (this.current + 1) % this.n;\r
    const fired: Timer[] = [];\r
    const keep: Timer[] = [];\r
    for (const t of this.slots[this.current]) {\r
      if (t.rounds === 0) fired.push(t);\r
      else { t.rounds--; keep.push(t); }\r
    }\r
    this.slots[this.current] = keep;\r
    return fired;\r
  }\r
\r
  /** All pending timers, for inspection/rendering. */\r
  pending(): { bucket: number; timers: Timer[] }[] {\r
    return this.slots.map((timers, bucket) => ({ bucket, timers }));\r
  }\r
}\r
`;export{e as default};