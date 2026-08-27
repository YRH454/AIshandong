var e=`// From transistors to logic — the very bottom of the stack. A MOSFET transistor is an electrically-controlled\r
// switch: a voltage on its gate terminal decides whether current can flow between the other two. There are two\r
// flavors. An NMOS conducts when its gate is HIGH (1) and blocks when low; a PMOS is the mirror image, conducting\r
// when its gate is LOW (0). CMOS logic pairs them: every gate has a PULL-UP network of PMOS transistors connecting\r
// the output to power (1) and a complementary PULL-DOWN network of NMOS connecting it to ground (0), wired so that\r
// for any input exactly one network conducts — the output is never left floating and, in steady state, no current\r
// flows straight through (which is why CMOS sips power). An inverter is one PMOS over one NMOS. A NAND puts the\r
// two PMOS in PARALLEL (output goes high if EITHER input is low) and the two NMOS in SERIES (output goes low only\r
// if BOTH are high) — which is exactly NOT(a AND b). Swap series for parallel and you get NOR. The punchline is\r
// UNIVERSALITY: NAND alone can build every boolean function — NOT is a NAND with tied inputs, AND is NAND then\r
// NOT, OR is NAND of two inverted inputs, XOR is four NANDs — so a chip fab really only needs to perfect one gate.\r
// Stack these into the adder, the flip-flop, and the ALU, and you have a computer. This models the two\r
// transistor types, the CMOS pull-up/pull-down networks for NOT/NAND/NOR, and NAND universality with gate counts.\r
// Reference: any digital-logic text (Harris & Harris; Weste & Harris, CMOS VLSI Design).\r
\r
export type Bit = 0 | 1;\r
\r
/** A transistor as a switch: does it conduct for this gate voltage? */\r
export const nmos = (gate: Bit): boolean => gate === 1; // conducts when gate is HIGH\r
export const pmos = (gate: Bit): boolean => gate === 0; // conducts when gate is LOW\r
\r
// CMOS gates built from pull-up (PMOS→power) and pull-down (NMOS→ground) networks.\r
// Output is HIGH when the pull-up conducts, LOW when the pull-down conducts (complementary by construction).\r
export const inverter = (a: Bit): Bit => (pmos(a) && !nmos(a) ? 1 : 0);\r
export const nand = (a: Bit, b: Bit): Bit => ((pmos(a) || pmos(b)) && !(nmos(a) && nmos(b)) ? 1 : 0); // PMOS ‖, NMOS series\r
export const nor = (a: Bit, b: Bit): Bit => (pmos(a) && pmos(b) && !(nmos(a) || nmos(b)) ? 1 : 0);     // PMOS series, NMOS ‖\r
\r
// NAND universality — every gate from NAND alone.\r
export const notN = (a: Bit): Bit => nand(a, a);\r
export const andN = (a: Bit, b: Bit): Bit => nand(nand(a, b), nand(a, b));\r
export const orN = (a: Bit, b: Bit): Bit => nand(nand(a, a), nand(b, b));\r
export const xorN = (a: Bit, b: Bit): Bit => { const c = nand(a, b); return nand(nand(a, c), nand(b, c)); };\r
\r
/** How many NAND gates each function costs. */\r
export const NAND_COST: Record<'NOT' | 'AND' | 'OR' | 'XOR', number> = { NOT: 1, AND: 2, OR: 3, XOR: 4 };\r
\r
/** The two-input truth table of a gate function, for display. */\r
export const truthTable = (fn: (a: Bit, b: Bit) => Bit): { a: Bit; b: Bit; out: Bit }[] =>\r
  [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => ({ a: a as Bit, b: b as Bit, out: fn(a as Bit, b as Bit) }));\r
`;export{e as default};