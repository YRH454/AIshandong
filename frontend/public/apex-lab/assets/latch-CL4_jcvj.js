var e=`// How a circuit remembers one bit. Combinational logic like the adder is memoryless: its outputs depend only on\r
// the inputs present right now. Storage needs FEEDBACK. Cross-couple two NOR gates so each one's output feeds the\r
// other's input, and the pair snaps into one of two stable states and holds it with no clock and no power beyond\r
// leakage. That is an SR (set/reset) latch: Q = NOR(R, Qbar), Qbar = NOR(S, Q). Raise S and Q latches to 1;\r
// raise R and it latches to 0; drop both and it HOLDS the last value — that hold state is the stored bit. Driving\r
// S and R both high is illegal: it forces Q and Qbar both to 0 (they should be complements), and releasing it\r
// races. Real designs never expose S/R raw. A gated D latch adds one data input D and an enable: while enable is\r
// high Q follows D, while it is low Q holds — so you write on demand. The problem with a level-triggered latch is\r
// that Q tracks D the whole time the enable is high, which makes timing fragile. A D FLIP-FLOP fixes that by\r
// being EDGE-triggered: it samples D only at the instant the clock rises and ignores it otherwise, built as two\r
// gated latches in series (master then slave) on opposite clock phases. Wire n flip-flops to one clock and you\r
// have an n-bit REGISTER — the CPU's fastest storage, and the same 6-transistor SRAM cell that makes your cache.\r
// This models the SR latch (as a truth table and by settling the gate feedback), the D flip-flop's edge capture,\r
// and a register. Reference: any digital-logic text (Harris & Harris, Digital Design and Computer Architecture).\r
\r
export type Bit = 0 | 1;\r
const NOR = (a: Bit, b: Bit): Bit => (a === 0 && b === 0 ? 1 : 0);\r
\r
export type SrState = 'set' | 'reset' | 'hold' | 'invalid';\r
export interface SrResult { q: Bit; qbar: Bit; state: SrState; stable: boolean }\r
\r
/** Settle the cross-coupled NOR SR latch from a starting (q,qbar) under inputs S,R. */\r
export function srLatch(s: Bit, r: Bit, q0: Bit = 0, qbar0: Bit = 1): SrResult {\r
  let q = q0, qbar = qbar0, stable = false;\r
  for (let i = 0; i < 8; i++) {\r
    const nq = NOR(r, qbar), nqbar = NOR(s, q);   // each gate drives the other\r
    if (nq === q && nqbar === qbar) { stable = true; break; }\r
    q = nq; qbar = nqbar;\r
  }\r
  const state: SrState = s === 1 && r === 1 ? 'invalid' : s === 1 ? 'set' : r === 1 ? 'reset' : 'hold';\r
  return { q, qbar, state, stable };\r
}\r
\r
/** Gated D latch: while enable is high, Q follows D; while low, Q holds \`prev\`. */\r
export function dLatch(d: Bit, enable: Bit, prev: Bit): Bit {\r
  return enable === 1 ? d : prev;\r
}\r
\r
/** Edge-triggered D flip-flop: Q captures D only on a rising clock edge (0→1); otherwise holds. */\r
export function dFlipFlop(d: Bit, clkPrev: Bit, clkNow: Bit, q: Bit): Bit {\r
  const risingEdge = clkPrev === 0 && clkNow === 1;\r
  return risingEdge ? d : q;\r
}\r
\r
/** An n-bit register: latches the whole input word on a rising clock edge. */\r
export function register(input: number, bits: number, clkPrev: Bit, clkNow: Bit, q: number): number {\r
  return clkPrev === 0 && clkNow === 1 ? input & ((1 << bits) - 1) : q;\r
}\r
`;export{e as default};