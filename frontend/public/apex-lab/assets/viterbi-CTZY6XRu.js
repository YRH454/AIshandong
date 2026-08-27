var e=`// Convolutional coding + Viterbi decoding — forward error correction that fixes bit errors without\r
// any retransmission, the workhorse behind deep-space links, GSM, 802.11, and satellite TV. We use\r
// the textbook rate-1/2, constraint-length K=3 code with generator polynomials G1=111₂ (7 octal)\r
// and G2=101₂ (5 octal). The encoder is a 2-bit shift register: each input bit produces TWO output\r
// bits, so redundancy is spread across time. The decoder (Viterbi, 1967) finds the single most\r
// likely transmitted bit-sequence by walking a trellis of the 4 encoder states and, at every step,\r
// keeping only the lowest-Hamming-distance survivor path into each state — dynamic programming over\r
// the most-likely path. With free distance d_free=5 this code corrects up to 2 bit errors per run.\r
// Honest model: the encoder bits are hand-derived from the generators; the decoder is independent.\r
\r
export const STATES = [0, 1, 2, 3]; // each is the 2 previous input bits: bit1 = m1 (newer), bit0 = m2 (older)\r
\r
/** One encoder step from \`state\` on input \`u\`: returns the 2 output bits and the next state. */\r
export function encStep(state: number, u: number): { out: [number, number]; next: number } {\r
  const m1 = (state >> 1) & 1, m2 = state & 1;\r
  const o1 = u ^ m1 ^ m2; // G1 = 111 → taps on u, m1, m2\r
  const o2 = u ^ m2; //      G2 = 101 → taps on u, m2\r
  const next = ((u << 1) | m1) & 3; // shift u in: new m1 = u, new m2 = old m1\r
  return { out: [o1, o2], next };\r
}\r
\r
export interface Encoded {\r
  codeword: number[]; // 2 bits per input (message + 2 flush zeros)\r
  transitions: { from: number; u: number; out: [number, number]; to: number }[];\r
}\r
\r
/** Encode a message, appending K-1=2 zero "flush" bits so the trellis terminates in state 0. */\r
export function encode(msg: number[]): Encoded {\r
  const bits = [...msg, 0, 0];\r
  let state = 0;\r
  const codeword: number[] = [];\r
  const transitions: Encoded['transitions'] = [];\r
  for (const u of bits) {\r
    const { out, next } = encStep(state, u);\r
    codeword.push(out[0], out[1]);\r
    transitions.push({ from: state, u, out, to: next });\r
    state = next;\r
  }\r
  return { codeword, transitions };\r
}\r
\r
export interface Edge { from: number; to: number; u: number; out: [number, number]; bm: number; survivor: boolean; ml: boolean }\r
export interface Stage { t: number; r: [number, number]; edges: Edge[]; metricAfter: (number | null)[] }\r
export interface Decoded {\r
  decoded: number[]; // recovered message (flush bits stripped)\r
  reencoded: number[]; // the codeword the survivor path implies\r
  corrections: number[]; // indices where the received word differed from the survivor codeword\r
  stages: Stage[]; // full trellis for visualization\r
  endState: number; // traceback start (should be 0 thanks to flushing)\r
}\r
\r
const INF = Infinity;\r
\r
/** Hard-decision Viterbi decode of a received bit stream (length 2·stages). */\r
export function decode(received: number[]): Decoded {\r
  const T = Math.floor(received.length / 2);\r
  let metric: number[] = [0, INF, INF, INF]; // start in state 0\r
  const survAll: ({ prev: number; u: number } | null)[][] = [];\r
  const stages: Stage[] = [];\r
\r
  for (let t = 0; t < T; t++) {\r
    const r: [number, number] = [received[2 * t], received[2 * t + 1]];\r
    const nm = [INF, INF, INF, INF];\r
    const surv: ({ prev: number; u: number } | null)[] = [null, null, null, null];\r
    const edges: Edge[] = [];\r
    for (const s of STATES) {\r
      for (const u of [0, 1]) {\r
        const { out, next } = encStep(s, u);\r
        const bm = (out[0] ^ r[0]) + (out[1] ^ r[1]); // branch metric = Hamming(expected, received)\r
        const cand = metric[s] === INF ? INF : metric[s] + bm;\r
        let survivor = false;\r
        if (cand < nm[next]) { nm[next] = cand; surv[next] = { prev: s, u }; survivor = true; }\r
        edges.push({ from: s, to: next, u, out, bm, survivor: false, ml: false });\r
        // mark survivor flag after the fact below (a later better edge can demote this one)\r
        void survivor;\r
      }\r
    }\r
    // recompute which edge is the actual survivor into each \`to\` (lowest cand, deterministic)\r
    for (const e of edges) {\r
      const cand = metric[e.from] === INF ? INF : metric[e.from] + e.bm;\r
      e.survivor = surv[e.to] != null && surv[e.to]!.prev === e.from && surv[e.to]!.u === e.u && cand === nm[e.to];\r
    }\r
    survAll.push(surv);\r
    stages.push({ t, r, edges, metricAfter: nm.map((m) => (m === INF ? null : m)) });\r
    metric = nm;\r
  }\r
\r
  // traceback from state 0 (flushing guarantees we end there)\r
  let state = 0;\r
  const dec: number[] = [];\r
  const mlEdge: { t: number; from: number; to: number; u: number }[] = [];\r
  for (let t = T - 1; t >= 0; t--) {\r
    const e = survAll[t][state];\r
    if (!e) break;\r
    dec.unshift(e.u);\r
    mlEdge.unshift({ t, from: e.prev, to: state, u: e.u });\r
    state = e.prev;\r
  }\r
  // flag the ML path edges in the stages\r
  for (const m of mlEdge) {\r
    const st = stages[m.t];\r
    const edge = st.edges.find((e) => e.from === m.from && e.to === m.to && e.u === m.u);\r
    if (edge) edge.ml = true;\r
  }\r
\r
  const decoded = dec.slice(0, Math.max(0, dec.length - 2)); // strip the 2 flush bits\r
  const reencoded = encode(decoded).codeword;\r
  const corrections: number[] = [];\r
  for (let i = 0; i < Math.min(received.length, reencoded.length); i++) if (received[i] !== reencoded[i]) corrections.push(i);\r
\r
  return { decoded, reencoded, corrections, stages, endState: state };\r
}\r
`;export{e as default};