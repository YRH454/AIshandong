var e=`// Karatsuba multiplication — the algorithm that broke the O(n²) barrier for multiplying big numbers, found by a\r
// 23-year-old Anatoly Karatsuba in 1960 after Kolmogorov conjectured n² was optimal (it disproved the conjecture\r
// within a week). The schoolbook method multiplies every digit of one number by every digit of the other: n²\r
// single-digit multiplies. Karatsuba's insight is a bit of algebra. Split each n-digit number in half around the\r
// base B = 10^m:  x = a·B + b,  y = c·B + d. Then\r
//     x·y = ac·B² + (ad + bc)·B + bd\r
// which looks like FOUR products (ac, ad, bc, bd). But the cross term ad+bc can be recovered from just ONE extra\r
// product instead of two:\r
//     (a+b)(c+d) = ac + ad + bc + bd,  so  ad + bc = (a+b)(c+d) − ac − bd.\r
// So you compute only THREE half-size products — ac, bd, and (a+b)(c+d) — and combine. Recurse, and trading 4\r
// sub-multiplies for 3 at every level turns n² into n^log₂3 ≈ n^1.585. The asymptotic ratio is n^0.415 — already\r
// ~18× fewer multiplies at 1000 digits (this base-10 demo does somewhat less, ~9×, because the (a+b)(c+d) halves\r
// can carry an extra digit and inflate that sub-tree), and it keeps widening; it's why big-integer libraries (and\r
// thus RSA/ECC key math) use Karatsuba above a few dozen digits, switching to Toom-Cook and then FFT-based\r
// multiplication for truly huge operands. This models the recursion and\r
// counts single-digit multiplies against schoolbook. Reference: Karatsuba & Ofman (1962).\r
\r
export interface Node { x: bigint; y: bigint; m: number; children: Node[]; product: bigint }\r
export interface Trace { product: bigint; mults: number; tree: Node }\r
\r
const digits = (n: bigint): number => (n < 0n ? -n : n).toString().length;\r
\r
/** Karatsuba multiply, recording the recursion tree and counting base-case (single-digit) multiplies. */\r
export function karatsuba(x: bigint, y: bigint): Trace {\r
  let mults = 0;\r
  const rec = (x: bigint, y: bigint): Node => {\r
    if (x < 10n && y < 10n) { mults++; return { x, y, m: 0, children: [], product: x * y }; } // one digit×digit\r
    const m = Math.floor(Math.max(digits(x), digits(y)) / 2);\r
    const B = 10n ** BigInt(m);\r
    const a = x / B, b = x % B;     // high, low halves of x\r
    const c = y / B, d = y % B;     // high, low halves of y\r
    const z2 = rec(a, c);           // ac\r
    const z0 = rec(b, d);           // bd\r
    const z1 = rec(a + b, c + d);   // (a+b)(c+d)\r
    const cross = z1.product - z2.product - z0.product; // ad + bc, from one product not two\r
    const product = z2.product * B * B + cross * B + z0.product;\r
    return { x, y, m, children: [z2, z0, z1], product };\r
  };\r
  const tree = rec(x, y);\r
  return { product: tree.product, mults, tree };\r
}\r
\r
/** Schoolbook multiply count: n×n single-digit multiplies for numbers of these digit-lengths. */\r
export const schoolbookMults = (x: bigint, y: bigint): number => digits(x) * digits(y);\r
`;export{e as default};