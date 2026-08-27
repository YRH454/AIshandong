var e=`// 802.11 CSMA/CA — how WiFi stations share one half-duplex channel without a\r
// referee. A station with a frame waits for the channel to be idle (a DIFS), then\r
// picks a random backoff in [0, CW] and counts down one slot per idle slot, FREEZING\r
// while someone else transmits. Whoever reaches 0 first seizes the channel; the\r
// receiver returns an ACK = success. If two stations hit 0 in the SAME slot they\r
// collide (no ACK), DOUBLE their contention window (binary exponential backoff) and\r
// re-draw — which is why a busy WiFi network gets slower super-linearly. Deterministic\r
// (seeded), so the contention is reproducible. Tested.\r
\r
export const CW_MIN = 7; // initial contention window (slots), 802.11-ish\r
export const CW_MAX = 255; // cap\r
\r
/** Mulberry32 — a tiny deterministic PRNG (so the contention is reproducible). */\r
export function rng(seed: number): () => number {\r
  let a = seed >>> 0;\r
  return () => {\r
    a |= 0; a = (a + 0x6d2b79f5) | 0;\r
    let t = Math.imul(a ^ (a >>> 15), 1 | a);\r
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;\r
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;\r
  };\r
}\r
\r
export interface Station { id: number; cw: number; backoff: number; sent: number; collisions: number }\r
\r
interface Snap { backoffs: number[]; cws: number[] } // each station's state AFTER this slot\r
export type SlotEvent =\r
  | ({ kind: 'idle' } & Snap)\r
  | ({ kind: 'transmit'; station: number; acked: true } & Snap)\r
  | ({ kind: 'collision'; stations: number[] } & Snap);\r
\r
export interface CsmaResult { stations: Station[]; timeline: SlotEvent[] }\r
\r
/** Simulate \`slots\` of CSMA/CA over \`n\` stations that always have a frame to send. */\r
export function simulateCsma(n: number, slots: number, seed = 1): CsmaResult {\r
  const rand = rng(seed);\r
  const draw = (cw: number) => Math.floor(rand() * (cw + 1)); // backoff ∈ [0, CW]\r
  const st: Station[] = Array.from({ length: n }, (_, id) => ({ id, cw: CW_MIN, backoff: draw(CW_MIN), sent: 0, collisions: 0 }));\r
  const timeline: SlotEvent[] = [];\r
\r
  const snap = (): { backoffs: number[]; cws: number[] } => ({ backoffs: st.map((x) => x.backoff), cws: st.map((x) => x.cw) });\r
  for (let s = 0; s < slots; s++) {\r
    const ready = st.filter((x) => x.backoff === 0);\r
    if (ready.length === 0) {\r
      // an idle slot: everyone decrements their backoff by one\r
      for (const x of st) x.backoff -= 1;\r
      timeline.push({ kind: 'idle', ...snap() });\r
      continue;\r
    }\r
    if (ready.length === 1) {\r
      // a clean transmission, ACKed; that station resets CW and draws a fresh backoff\r
      const w = ready[0];\r
      w.sent += 1; w.cw = CW_MIN; w.backoff = draw(CW_MIN);\r
      timeline.push({ kind: 'transmit', station: w.id, acked: true, ...snap() });\r
    } else {\r
      // collision: all the zero-backoff stations grow CW (BEB) and re-draw\r
      for (const w of ready) { w.collisions += 1; w.cw = Math.min(w.cw * 2 + 1, CW_MAX); w.backoff = draw(w.cw); }\r
      timeline.push({ kind: 'collision', stations: ready.map((x) => x.id), ...snap() });\r
    }\r
  }\r
  return { stations: st, timeline };\r
}\r
\r
/** Standalone illustration of the race: whoever has the lowest backoff counter reaches zero\r
 *  first and seizes the channel (a tie at the bottom is what causes a collision). NOTE: the\r
 *  simulation above transmits at backoff===0 specifically — a slot whose minimum is >0 is idle\r
 *  (everyone decrements, nobody sends); this helper just ranks who's closest to firing. */\r
export function lowestBackoff(backoffs: number[]): number[] {\r
  const min = Math.min(...backoffs);\r
  return backoffs.map((b, i) => (b === min ? i : -1)).filter((i) => i >= 0);\r
}\r
\r
/** Per-station share of successful transmissions (fairness check). */\r
export function shares(res: CsmaResult): number[] {\r
  const total = res.stations.reduce((a, x) => a + x.sent, 0) || 1;\r
  return res.stations.map((x) => x.sent / total);\r
}\r
`;export{e as default};