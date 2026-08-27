var e=`// Snowflake IDs (Twitter, 2010) — how distributed services mint 64-bit unique IDs with\r
// no coordination, that still sort roughly by time. The 64 bits pack four fields: an\r
// unused sign bit, a 41-bit millisecond timestamp (since a custom epoch), a 10-bit\r
// machine id (1024 workers), and a 12-bit per-millisecond sequence (4096 IDs/ms/worker).\r
// Because the timestamp is the high-order field, larger ID ⇒ later (or equal) time, so\r
// IDs are k-sortable — great for database primary keys. Pure BigInt bit-packing, tested.\r
\r
export const TWITTER_EPOCH = 1288834974657n; // 2010-11-04T01:42:54.657Z\r
export const TIMESTAMP_BITS = 41n, WORKER_BITS = 10n, SEQUENCE_BITS = 12n;\r
export const MAX_WORKER = (1n << WORKER_BITS) - 1n;   // 1023\r
export const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n; // 4095\r
\r
const WORKER_SHIFT = SEQUENCE_BITS;                 // 12\r
const TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_BITS; // 22\r
\r
/** Pack (timestamp, worker, sequence) into a 64-bit Snowflake. */\r
export function encode(tsMs: bigint, worker: bigint, sequence: bigint, epoch = TWITTER_EPOCH): bigint {\r
  return ((tsMs - epoch) << TIMESTAMP_SHIFT) | (worker << WORKER_SHIFT) | sequence;\r
}\r
\r
export interface Parts { tsMs: bigint; worker: bigint; sequence: bigint }\r
\r
/** Unpack a Snowflake back into its fields. */\r
export function decode(id: bigint, epoch = TWITTER_EPOCH): Parts {\r
  return {\r
    tsMs: (id >> TIMESTAMP_SHIFT) + epoch,\r
    worker: (id >> WORKER_SHIFT) & MAX_WORKER,\r
    sequence: id & MAX_SEQUENCE,\r
  };\r
}\r
\r
export interface GenState { lastMs: bigint; sequence: bigint }\r
\r
/** Generate the next ID for \`worker\` at clock \`nowMs\`, handling same-millisecond\r
 *  sequence increment and roll-over into the next millisecond. */\r
export function next(state: GenState, nowMs: bigint, worker: bigint, epoch = TWITTER_EPOCH): { id: bigint; state: GenState; rolledOver: boolean } {\r
  let ms: bigint, seq: bigint, rolledOver = false;\r
  if (nowMs > state.lastMs) {\r
    ms = nowMs; seq = 0n; // the clock advanced to a fresh millisecond → sequence resets\r
  } else {\r
    // same ms, OR the clock is behind our last ID (a sequence roll-over already spilled us into the\r
    // next ms, or the wall clock stepped backward): stay on state.lastMs and keep the sequence\r
    // strictly increasing, so IDs never go backward or repeat.\r
    ms = state.lastMs;\r
    seq = state.sequence + 1n;\r
    if (seq > MAX_SEQUENCE) { ms = state.lastMs + 1n; seq = 0n; rolledOver = true; } // exhausted this ms → spill to the next\r
  }\r
  return { id: encode(ms, worker, seq, epoch), state: { lastMs: ms, sequence: seq }, rolledOver };\r
}\r
\r
/** 64-bit binary string split for display: [sign, timestamp, worker, sequence]. */\r
export function bitFields(id: bigint): { sign: string; timestamp: string; worker: string; sequence: string } {\r
  const bin = id.toString(2).padStart(64, '0');\r
  return { sign: bin.slice(0, 1), timestamp: bin.slice(1, 42), worker: bin.slice(42, 52), sequence: bin.slice(52, 64) };\r
}\r
`;export{e as default};