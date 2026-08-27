var e=`// The fast inverse square root — the most famous 20 lines in game programming, from the Quake III Arena source.\r
// Computing 1/sqrt(x) is everywhere in 3D graphics (normalizing a vector — lighting, reflections — needs it per\r
// vertex), and in 1999 a hardware sqrt was slow. This code approximates it with NO division and NO sqrt, using a\r
// single integer subtraction and one refinement step:\r
//\r
//     i  = *(int*)&x;                 // reinterpret the float's BITS as an integer\r
//     i  = 0x5f3759df - (i >> 1);     // the magic line\r
//     y  = *(float*)&i;               // reinterpret back to float — already a good guess\r
//     y  = y * (1.5f - 0.5f*x*y*y);   // one Newton step polishes it to ~0.17% error\r
//\r
// Why it works is the beautiful part: an IEEE-754 float stores x as (1+m)·2^e, and its raw bit pattern, read as\r
// an integer, is very nearly a SCALED, SHIFTED log2(x) — the exponent field is the integer part of the log and\r
// the mantissa field linearly approximates the fractional part. So computing 1/sqrt(x) = x^(-1/2) is, in log\r
// space, just multiplying the log by -1/2 — which is exactly what \`-(i >> 1)\` does (shift = divide the log by 2,\r
// negate). The magic constant 0x5f3759df restores the exponent bias that the shift disturbed and nudges the\r
// mantissa's piecewise-linear fit to minimize error. Then one Newton-Raphson iteration on f(y)=1/y²-x roughly\r
// squares the precision. This models the bit reinterpretation, the magic line, and the Newton refinement.\r
// Reference: Quake III Arena source (id Software, 1999); Lomont, "Fast Inverse Square Root" (2003).\r
\r
export const MAGIC = 0x5f3759df;\r
\r
const f32 = new Float32Array(1);\r
const u32 = new Uint32Array(f32.buffer); // aliased views: same 4 bytes as float or as uint\r
\r
/** Reinterpret a float32's bits as a uint32 (the C \`*(int*)&x\`). */\r
export function bitsOf(x: number): number { f32[0] = x; return u32[0]; }\r
/** Reinterpret a uint32's bits as a float32 (the C \`*(float*)&i\`). */\r
export function floatOf(bits: number): number { u32[0] = bits >>> 0; return f32[0]; }\r
\r
/** Decompose a float32 into IEEE-754 fields (for display). */\r
export function fields(x: number): { sign: number; exponent: number; mantissa: number; bits: number } {\r
  const b = bitsOf(x);\r
  return { sign: (b >>> 31) & 1, exponent: (b >>> 23) & 0xff, mantissa: b & 0x7fffff, bits: b };\r
}\r
\r
export interface Result { guess: number; steps: number[]; refined: number; trueValue: number; relError: number }\r
\r
/** Fast inverse square root: the bit hack + \`iterations\` Newton-Raphson refinements. */\r
export function fastInvSqrt(x: number, iterations = 1): Result {\r
  const i = bitsOf(x);\r
  let y = floatOf((MAGIC - (i >>> 1)) >>> 0); // the magic line → initial guess\r
  const guess = y;\r
  const steps = [y];\r
  const halfX = 0.5 * x;\r
  // Newton-Raphson on f(y)=1/y²−x. (The original Quake code did this in float32; JS runs it in float64, which only\r
  // removes the tiny float32 rounding — the ~3.4%/~0.17%/~0.0005% error bounds per iteration are unchanged.)\r
  for (let k = 0; k < iterations; k++) { y = y * (1.5 - halfX * y * y); steps.push(y); }\r
  const trueValue = 1 / Math.sqrt(x);\r
  return { guess, steps, refined: y, trueValue, relError: Math.abs(y - trueValue) / trueValue };\r
}\r
`;export{e as default};