var e=`// Automatic Repeat reQuest — how reliable transport recovers a lost frame, and why\r
// the two classic strategies cost so differently. Both number frames and use a\r
// sliding window; they differ at the receiver:\r
//   • Go-Back-N: receiver window = 1. It discards anything after a gap and only\r
//     cumulative-ACKs the last in-order frame, so on timeout the sender resends the\r
//     lost frame AND everything sent after it.\r
//   • Selective Repeat: receiver window = N. It buffers out-of-order frames and\r
//     ACKs them individually, so the sender resends ONLY the lost frame.\r
// Pure, deterministic model (tested) — one frame dropped on its first transmission.\r
\r
export type Protocol = 'GBN' | 'SR';\r
export type Outcome = 'acked' | 'lost' | 'discarded' | 'buffered' | 'resent';\r
export interface Slot { frame: number; outcome: Outcome; pass: 1 | 2 }\r
\r
export interface ArqRun {\r
  protocol: Protocol;\r
  slots: Slot[]; // every transmission attempt, in order\r
  total: number; // total frames put on the wire\r
  retransmits: number; // how many were retransmissions (pass 2)\r
}\r
\r
/** Simulate sending frames 0..n-1 when \`lost\` is dropped on its first send. */\r
export function simulate(n: number, lost: number, protocol: Protocol): ArqRun {\r
  const slots: Slot[] = [];\r
  for (let f = 0; f < n; f++) {\r
    if (f < lost) slots.push({ frame: f, outcome: 'acked', pass: 1 });\r
    else if (f === lost) slots.push({ frame: f, outcome: 'lost', pass: 1 });\r
    else slots.push({ frame: f, outcome: protocol === 'GBN' ? 'discarded' : 'buffered', pass: 1 });\r
  }\r
  if (protocol === 'GBN') {\r
    for (let f = lost; f < n; f++) slots.push({ frame: f, outcome: 'resent', pass: 2 }); // go back N\r
  } else {\r
    slots.push({ frame: lost, outcome: 'resent', pass: 2 }); // selective: just the gap\r
  }\r
  const retransmits = slots.filter((s) => s.pass === 2).length;\r
  return { protocol, slots, total: slots.length, retransmits };\r
}\r
\r
/** Frames the receiver had to throw away (GBN) — wasted work the wire still paid for. */\r
export const wasted = (run: ArqRun): number => run.slots.filter((s) => s.outcome === 'discarded').length;\r
`;export{e as default};