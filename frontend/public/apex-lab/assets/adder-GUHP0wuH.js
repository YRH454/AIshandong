var e=`// The binary adder — how a pile of logic gates does arithmetic. Everything a CPU computes is built up from one\r
// tiny circuit, the FULL ADDER: it takes two bits plus a carry-in and produces a sum bit and a carry-out. Its\r
// logic is just three gates' worth of boolean algebra — sum = a XOR b XOR carryIn, and carryOut = (a AND b) OR\r
// (carryIn AND (a XOR b)) — i.e. "carry out if at least two of the three inputs are 1." Chain n of them, feeding\r
// each carry-out into the next stage's carry-in, and you get an n-bit RIPPLE-CARRY ADDER that adds two n-bit\r
// numbers exactly the way you add decimal digits on paper: right to left, carrying as you go. The catch that\r
// shapes real CPUs is right there in the name: the carry has to RIPPLE. Bit 31's correct value can't be known\r
// until bit 30's carry is known, which needs bit 29's, all the way down — so the worst-case delay grows linearly\r
// with the width (a 64-bit ripple adder is 64 gate-delays deep), and that critical path would cap your clock\r
// speed. That single problem is why real ALUs use carry-LOOKAHEAD (or carry-select/prefix) adders that compute\r
// the carries in parallel from "generate" (a AND b) and "propagate" (a XOR b) signals in O(log n) depth instead\r
// of O(n). This models the full-adder truth table, the ripple, overflow, and the carry-chain depth that motivates\r
// lookahead. Reference: any digital-logic text (Harris & Harris, "Digital Design and Computer Architecture").\r
\r
export interface BitStep { i: number; a: number; b: number; cin: number; sum: number; cout: number }\r
export interface AddResult { steps: BitStep[]; sum: number; carryOut: number; rippleDepth: number }\r
\r
/** One full adder: two input bits + carry-in → sum bit + carry-out. */\r
export function fullAdder(a: number, b: number, cin: number): { sum: number; cout: number } {\r
  const sum = a ^ b ^ cin;\r
  const cout = (a & b) | (cin & (a ^ b)); // carry if ≥2 of the three inputs are 1\r
  return { sum, cout };\r
}\r
\r
/** n-bit ripple-carry addition, LSB→MSB, recording every stage. */\r
export function rippleAdd(a: number, b: number, bits: number): AddResult {\r
  const steps: BitStep[] = [];\r
  let carry = 0, sum = 0, depth = 0, chain = 0;\r
  for (let i = 0; i < bits; i++) {\r
    const ai = (a >>> i) & 1, bi = (b >>> i) & 1, cin = carry;\r
    const { sum: s, cout } = fullAdder(ai, bi, cin);\r
    steps.push({ i, a: ai, b: bi, cin, sum: s, cout });\r
    sum |= s << i;\r
    chain = cout ? chain + 1 : 0;          // length of the current run of propagated carries\r
    depth = Math.max(depth, chain);\r
    carry = cout;\r
  }\r
  return { steps, sum: sum >>> 0, carryOut: carry, rippleDepth: depth };\r
}\r
`;export{e as default};