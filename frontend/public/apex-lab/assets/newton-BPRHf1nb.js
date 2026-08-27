var e=`// Newton's method — find where a function crosses zero by following its tangent. From a guess x, the\r
// tangent line f(x) + f'(x)(t−x) hits zero at t = x − f(x)/f'(x); take that as the next guess and repeat.\r
// When it works it's astonishingly fast: the error roughly SQUARES every step (quadratic convergence),\r
// so the number of correct digits doubles each iteration — a handful of steps reach machine precision.\r
// The classic special case is the Babylonian square root: solving x² − a = 0 gives the iteration\r
// x ← (x + a/x)/2. The catch is robustness — a near-zero derivative, a bad starting point, or an\r
// inflection can send it shooting off or oscillating, which is why real solvers guard it (bisection\r
// fallback, damping). Reference: Newton/Raphson; any numerical-analysis text (e.g. Burden & Faires).\r
\r
export interface NewtonStep { i: number; x: number; fx: number; fpx: number; next: number; error: number }\r
\r
/** Iterate Newton's method on f with derivative fprime from x0, for n steps. \`root\` (if known) is used\r
 *  only to report the error each step so the quadratic convergence is visible. */\r
export function newton(f: (x: number) => number, fprime: (x: number) => number, x0: number, n: number, root?: number): NewtonStep[] {\r
  const steps: NewtonStep[] = [];\r
  let x = x0;\r
  for (let i = 0; i < n; i++) {\r
    const fx = f(x), fpx = fprime(x);\r
    const next = fpx === 0 ? x : x - fx / fpx; // a flat tangent has no finite intercept\r
    steps.push({ i, x, fx, fpx, next, error: root !== undefined ? Math.abs(x - root) : Math.abs(fx) });\r
    x = next;\r
  }\r
  return steps;\r
}\r
\r
/** Babylonian square root: Newton on f(x) = x² − a. */\r
export const sqrtNewton = (a: number, x0: number, n: number) =>\r
  newton((x) => x * x - a, (x) => 2 * x, x0, n, Math.sqrt(a));\r
\r
export interface Fn { label: string; f: (x: number) => number; fprime: (x: number) => number; root: number; x0: number }\r
export const FUNCTIONS: Record<string, Fn> = {\r
  '√2  (x²−2)': { label: '√2', f: (x) => x * x - 2, fprime: (x) => 2 * x, root: Math.sqrt(2), x0: 2 },\r
  'cube root of 5  (x³−5)': { label: '∛5', f: (x) => x ** 3 - 5, fprime: (x) => 3 * x * x, root: Math.cbrt(5), x0: 2 },\r
  'x³ − x − 2': { label: 'root', f: (x) => x ** 3 - x - 2, fprime: (x) => 3 * x * x - 1, root: 1.5213797068045676, x0: 2 },\r
};\r
`;export{e as default};