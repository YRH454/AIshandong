var e=`// The ALU (Arithmetic Logic Unit) — the part of a CPU that actually computes. It's the adder plus a handful of\r
// logic gates, with a MULTIPLEXER on the output that an opcode uses to pick which result to keep. One circuit\r
// computes a+b, a-b, a&b, a|b, a^b, shifts, and comparisons all at once; the opcode selects one. Subtraction\r
// reuses the adder: a - b is a + (~b) + 1 in two's complement, so feeding the adder an inverted b and a carry-in\r
// of 1 turns the same hardware into a subtractor. Alongside the result the ALU raises FLAGS that branches read:\r
// Zero (result is 0), Negative (top bit set), Carry (carry out of the top bit — unsigned overflow / borrow), and\r
// oVerflow (signed overflow: two same-sign inputs produced a different-sign result). Those four bits are how\r
// \`if (a > b)\` becomes a compare-then-branch. This models the operations and the flags, reusing the ripple adder.\r
// Reference: Harris & Harris, Digital Design and Computer Architecture; Patterson & Hennessy, MIPS ALU.\r
\r
export type Op = 'ADD' | 'SUB' | 'AND' | 'OR' | 'XOR' | 'SHL' | 'SHR' | 'SLT';\r
export const OPS: Op[] = ['ADD', 'SUB', 'AND', 'OR', 'XOR', 'SHL', 'SHR', 'SLT'];\r
\r
export interface Flags { zero: number; negative: number; carry: number; overflow: number }\r
export interface AluResult extends Flags { result: number; op: Op }\r
\r
/** Add with flags (also the subtractor when fed ~b and cin=1). */\r
function addWithFlags(a: number, b: number, cin: number, bits: number): { result: number; carry: number; overflow: number } {\r
  const mask = (1 << bits) - 1, msb = 1 << (bits - 1);\r
  const raw = a + b + cin;\r
  const result = raw & mask;\r
  const carry = (raw >>> bits) & 1;\r
  const sa = a & msb, sb = b & msb, sr = result & msb;\r
  const overflow = sa === sb && sr !== sa ? 1 : 0; // same-sign inputs, different-sign result\r
  return { result, carry, overflow };\r
}\r
\r
/** Run one ALU operation over \`bits\`-wide inputs, producing the result and the Z/N/C/V flags. */\r
export function alu(a: number, b: number, op: Op, bits = 8): AluResult {\r
  const mask = (1 << bits) - 1, msb = 1 << (bits - 1);\r
  a &= mask; b &= mask;\r
  let result = 0, carry = 0, overflow = 0;\r
  switch (op) {\r
    case 'ADD': ({ result, carry, overflow } = addWithFlags(a, b, 0, bits)); break;\r
    case 'SUB': ({ result, carry, overflow } = addWithFlags(a, ~b & mask, 1, bits)); break; // a + (~b) + 1\r
    case 'AND': result = a & b; break;\r
    case 'OR': result = a | b; break;\r
    case 'XOR': result = a ^ b; break;\r
    case 'SHL': result = (a << (b & (bits - 1))) & mask; break;\r
    case 'SHR': result = a >>> (b & (bits - 1)); break;\r
    case 'SLT': result = ((a & msb ? a - (1 << bits) : a) < (b & msb ? b - (1 << bits) : b)) ? 1 : 0; break; // signed set-less-than\r
  }\r
  return { result, op, zero: result === 0 ? 1 : 0, negative: (result & msb) ? 1 : 0, carry, overflow };\r
}\r
`;export{e as default};