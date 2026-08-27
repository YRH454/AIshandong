var e=`// Nagle's algorithm (RFC 896) and delayed ACK (RFC 1122) — and the notorious stall when the\r
// two meet. Nagle fights the "tinygram" problem: if you have unacknowledged data in flight,\r
// don't send another *sub-MSS* segment — buffer it until either you've accumulated a full MSS\r
// or all outstanding data is ACKed. Delayed ACK does the dual thing on the receiver: don't ACK\r
// a lone segment immediately; wait up to a timer (RFC 1122: ≤500 ms, commonly 40–200 ms) hoping\r
// to piggyback the ACK on reply data or to ACK two segments at once. Each is a fine idea alone.\r
// Together, in a write-write-read pattern, they deadlock: the sender holds the second small\r
// segment waiting for an ACK, while the receiver holds the ACK waiting for a second segment.\r
// Nobody moves until the receiver's delayed-ACK timer fires — a 40–200 ms stall on an otherwise\r
// instant exchange. Honest discrete-event timing model (one-way delay = RTT/2), tested.\r
\r
export interface NagleConfig {\r
  writes: number[]; // application write() sizes (bytes), issued back-to-back as separate syscalls\r
  mss: number; // maximum segment size (payload bytes per segment)\r
  rttMs: number; // round-trip time; one-way delay = rttMs / 2\r
  nagle: boolean; // Nagle's algorithm enabled on the sender (TCP_NODELAY off)\r
  delayedAck: boolean; // delayed ACK enabled on the receiver\r
  delayedAckMs: number; // delayed-ACK timer\r
}\r
\r
export interface NagleEvent {\r
  kind: 'send' | 'deliver' | 'ack' | 'ack-recv'; // send=segment leaves sender, deliver=arrives at receiver,\r
  t: number; //                                     ack=receiver emits ACK, ack-recv=ACK reaches sender\r
  seg: number; // segment number (1-based) for send/deliver; for ack* the cumulative bytes acked\r
  bytes: number; // payload bytes (send/deliver) or bytes-acked (ack/ack-recv)\r
  reason?: string; // why this segment was sent now (only on 'send')\r
}\r
\r
export interface NagleResult {\r
  events: NagleEvent[];\r
  segments: number; // how many TCP segments carried the payload\r
  bytes: number; // total payload bytes\r
  completionMs: number; // when the last byte was ACKed back to the sender\r
  stalledMs: number; // total wall-clock the sender spent Nagle-blocked with data waiting to go\r
  stalls: { from: number; to: number }[]; // the exact intervals the sender was Nagle-blocked\r
}\r
\r
/** Simulate the exchange and return the segment/ACK timeline. */\r
export function simulate(cfg: NagleConfig): NagleResult {\r
  const { mss, nagle, delayedAck, delayedAckMs } = cfg;\r
  const owd = cfg.rttMs / 2;\r
  const totalBytes = cfg.writes.reduce((a, b) => a + b, 0);\r
\r
  // sender state\r
  let buffer = 0; // bytes accepted from the app but not yet sent\r
  let sentBytes = 0; // cumulative payload sent\r
  let ackedBytes = 0; // cumulative payload ACKed\r
  let segNo = 0; // segments emitted so far\r
  let heldSince: number | null = null; // when the sender first started Nagle-holding the current data\r
  let stalledMs = 0;\r
  const stalls: { from: number; to: number }[] = [];\r
\r
  // receiver state\r
  let delivered = 0; // cumulative bytes delivered to the receiver\r
  let pending = 0; // delivered-but-not-yet-ACKed segments\r
  let ackGen = 0; // generation counter to invalidate superseded delayed-ACK timers\r
\r
  const events: NagleEvent[] = [];\r
  let completionMs = 0;\r
\r
  // event queue with stable (t, seq) ordering\r
  type Ev =\r
    | { t: number; seq: number; type: 'write'; bytes: number }\r
    | { t: number; seq: number; type: 'deliver'; seg: number; bytes: number }\r
    | { t: number; seq: number; type: 'ackTimer'; gen: number }\r
    | { t: number; seq: number; type: 'ackRecv'; ackTo: number };\r
  const q: Ev[] = [];\r
  let seq = 0;\r
  type NoSeq<T> = T extends unknown ? Omit<T, 'seq'> : never; // distribute Omit over the union\r
  const push = (e: NoSeq<Ev>) => q.push({ ...e, seq: seq++ } as Ev);\r
\r
  cfg.writes.forEach((w) => push({ t: 0, type: 'write', bytes: w }));\r
\r
  const outstanding = () => sentBytes - ackedBytes;\r
\r
  const updateHold = (now: number) => {\r
    const holding = nagle && buffer > 0 && outstanding() > 0; // (buffer<mss here, else it'd have been sent)\r
    if (holding && heldSince === null) heldSince = now;\r
    else if (!holding && heldSince !== null) {\r
      if (now > heldSince) {\r
        stalledMs += now - heldSince;\r
        stalls.push({ from: heldSince, to: now });\r
      }\r
      heldSince = null;\r
    }\r
  };\r
\r
  const sendSeg = (now: number, n: number, reason: string) => {\r
    segNo += 1;\r
    buffer -= n;\r
    sentBytes += n;\r
    events.push({ kind: 'send', t: now, seg: segNo, bytes: n, reason });\r
    push({ t: now + owd, type: 'deliver', seg: segNo, bytes: n });\r
  };\r
\r
  const flush = (now: number) => {\r
    while (buffer > 0) {\r
      if (!nagle) {\r
        sendSeg(now, Math.min(buffer, mss), 'sent immediately (Nagle disabled)');\r
      } else if (buffer >= mss) {\r
        sendSeg(now, mss, 'full MSS — Nagle always ships full-sized segments');\r
      } else if (outstanding() === 0) {\r
        sendSeg(now, buffer, heldSince !== null ? 'all prior data ACKed — Nagle releases the held segment' : 'no unacknowledged data in flight — small send allowed');\r
      } else {\r
        break; // sub-MSS with data in flight → Nagle holds it\r
      }\r
    }\r
    updateHold(now);\r
  };\r
\r
  const ackNow = (now: number) => {\r
    ackGen += 1; // supersede any pending timer\r
    pending = 0;\r
    events.push({ kind: 'ack', t: now, seg: delivered, bytes: delivered - ackedBytes });\r
    push({ t: now + owd, type: 'ackRecv', ackTo: delivered });\r
  };\r
\r
  let guard = 0;\r
  while (q.length && guard++ < 100000) {\r
    q.sort((a, b) => a.t - b.t || a.seq - b.seq);\r
    const e = q.shift()!;\r
    switch (e.type) {\r
      case 'write':\r
        buffer += e.bytes;\r
        flush(e.t);\r
        break;\r
      case 'deliver':\r
        delivered += e.bytes;\r
        pending += 1;\r
        if (!delayedAck) ackNow(e.t);\r
        else if (pending >= 2) ackNow(e.t); // 2nd outstanding segment → ACK immediately (RFC 1122)\r
        else push({ t: e.t + delayedAckMs, type: 'ackTimer', gen: ackGen }); // arm the timer\r
        break;\r
      case 'ackTimer':\r
        if (e.gen === ackGen && pending > 0) ackNow(e.t);\r
        break;\r
      case 'ackRecv':\r
        ackedBytes = e.ackTo;\r
        events.push({ kind: 'ack-recv', t: e.t, seg: ackedBytes, bytes: 0 });\r
        if (ackedBytes >= totalBytes) completionMs = e.t;\r
        flush(e.t); // an ACK may let Nagle release held data\r
        break;\r
    }\r
  }\r
\r
  return { events, segments: segNo, bytes: totalBytes, completionMs, stalledMs, stalls };\r
}\r
\r
/** A few teaching presets. */\r
export const PRESETS: { id: string; label: string; writes: number[]; note: string }[] = [\r
  { id: 'ww', label: 'write-write-read (50 B + 50 B)', writes: [50, 50], note: 'The classic stall: a header then a body as two small writes.' },\r
  { id: 'keystroke', label: 'telnet keystrokes (1 B ×5)', writes: [1, 1, 1, 1, 1], note: 'Tinygrams — Nagle coalesces them; without it each is a 41-byte packet for 1 byte.' },\r
  { id: 'bulk', label: 'bulk send (4000 B)', writes: [4000], note: 'Nagle ships full MSS segments instantly and only holds the sub-MSS tail.' },\r
];\r
`;export{e as default};