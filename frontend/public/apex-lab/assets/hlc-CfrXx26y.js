var e=`// Hybrid Logical Clocks (Kulkarni et al., 2014) — timestamps that are BOTH close to real\r
// wall-clock time AND capture causality, in a constant 64-bit-ish package. A Lamport clock\r
// captures happens-before but drifts arbitrarily far from real time; a physical clock is\r
// real but can't order causally-related events when clocks are skewed or run backwards. An\r
// HLC is a pair (l, c): l tracks the largest physical time seen (so it stays near real\r
// time), and c is a small counter that breaks ties and absorbs backward clock jumps. The\r
// update rules guarantee: if event a happens-before b then HLC(a) < HLC(b) lexicographically,\r
// and l never trails the local physical clock by much. Used by CockroachDB and MongoDB for\r
// cross-node ordering without a global clock. Pure, tested against a hand-worked trace.\r
\r
export interface Hlc { l: number; c: number }\r
\r
export const compare = (a: Hlc, b: Hlc): number => a.l - b.l || a.c - b.c;\r
\r
/** A local event (or send) at physical time \`pt\`: keep l near real time, bump c on a tie. */\r
export function localEvent(prev: Hlc, pt: number): Hlc {\r
  const l = Math.max(prev.l, pt);\r
  return { l, c: l === prev.l ? prev.c + 1 : 0 };\r
}\r
\r
/** Receiving a message stamped \`msg\` at physical time \`pt\`. */\r
export function recvEvent(prev: Hlc, msg: Hlc, pt: number): Hlc {\r
  const l = Math.max(prev.l, msg.l, pt);\r
  let c: number;\r
  if (l === prev.l && l === msg.l) c = Math.max(prev.c, msg.c) + 1;\r
  else if (l === prev.l) c = prev.c + 1;\r
  else if (l === msg.l) c = msg.c + 1;\r
  else c = 0;\r
  return { l, c };\r
}\r
\r
export type Event =\r
  | { kind: 'local'; pt: number; label: string }\r
  | { kind: 'send'; pt: number; label: string }\r
  | { kind: 'recv'; pt: number; msg: Hlc; label: string };\r
\r
export interface Stamped { event: Event; hlc: Hlc; skew: number } // skew = l − pt (drift from real time)\r
\r
/** Replay a sequence of events on one node, stamping each with its HLC. */\r
export function run(events: Event[], start: Hlc = { l: 0, c: 0 }): Stamped[] {\r
  let cur = start;\r
  return events.map((event) => {\r
    cur = event.kind === 'recv' ? recvEvent(cur, event.msg, event.pt) : localEvent(cur, event.pt);\r
    return { event, hlc: { ...cur }, skew: cur.l - event.pt };\r
  });\r
}\r
\r
export const fmt = (h: Hlc): string => \`\${h.l}.\${h.c}\`;\r
`;export{e as default};