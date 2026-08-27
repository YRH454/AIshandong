var e=`// ReDoS — Regular-expression Denial of Service, aka catastrophic backtracking. A classic backtracking regex\r
// engine, given an "evil" pattern with nested quantifiers like (a+)+ and an input that ALMOST matches, tries\r
// every possible way to split the input among the quantifiers before giving up — and the number of ways is\r
// EXPONENTIAL in the input length. So a 30-character string against one bad regex can take seconds; a\r
// 40-character one, hours. A single crafted request pins a CPU. It has bitten Cloudflare (a 2019 global\r
// outage from one regex), Stack Overflow, and countless validators. We implement a tiny CPS backtracking\r
// matcher that COUNTS the work, so you can watch a safe pattern stay linear while an evil one explodes.\r
// Reference: the RE2 papers (Cox); OWASP ReDoS.\r
\r
export type Node =\r
  | { t: 'lit'; c: string }\r
  | { t: 'plus'; n: Node }       // one or more, greedy\r
  | { t: 'star'; n: Node }       // zero or more, greedy\r
  | { t: 'concat'; ns: Node[] };\r
\r
interface Ctx { steps: number; limit: number }\r
\r
/** Greedy backtracking match in continuation-passing style; every call is one unit of "work" (steps). Bails\r
 *  out once steps exceeds \`limit\` (so a truly catastrophic case doesn't hang the browser). */\r
function m(node: Node, s: string, pos: number, cont: (p: number) => boolean, ctx: Ctx): boolean {\r
  if (++ctx.steps > ctx.limit) return false;\r
  switch (node.t) {\r
    case 'lit':\r
      return pos < s.length && s[pos] === node.c && cont(pos + 1);\r
    case 'concat': {\r
      const go = (i: number, p: number): boolean => (i === node.ns.length ? cont(p) : m(node.ns[i], s, p, (p2) => go(i + 1, p2), ctx));\r
      return go(0, pos);\r
    }\r
    case 'plus': {\r
      // require one match, then greedily try to repeat before falling through to the continuation\r
      const rep = (p: number): boolean => m(node.n, s, p, (p2) => (p2 === p ? cont(p2) : rep(p2) || cont(p2)), ctx);\r
      return rep(pos);\r
    }\r
    case 'star': {\r
      const rep = (p: number): boolean => {\r
        const more = m(node.n, s, p, (p2) => (p2 === p ? false : rep(p2) || cont(p2)), ctx);\r
        return more || cont(p);\r
      };\r
      return rep(pos);\r
    }\r
  }\r
}\r
\r
export interface MatchResult { matched: boolean; steps: number; blownUp: boolean }\r
\r
/** Match \`pattern\` against the whole of \`input\` (anchored), counting backtracking steps up to \`limit\`. */\r
export function run(pattern: Node, input: string, limit = 2_000_000): MatchResult {\r
  const ctx: Ctx = { steps: 0, limit };\r
  const matched = m(pattern, input, 0, (p) => p === input.length, ctx);\r
  return { matched, steps: ctx.steps, blownUp: ctx.steps > limit };\r
}\r
\r
// A few named patterns. lit('a') helper keeps them readable.\r
const a: Node = { t: 'lit', c: 'a' };\r
export const PATTERNS: Record<string, { label: string; node: Node; evil: boolean }> = {\r
  evilPlus: { label: '(a+)+', node: { t: 'plus', n: { t: 'plus', n: a } }, evil: true },\r
  evilStar: { label: '(a*)*', node: { t: 'star', n: { t: 'star', n: a } }, evil: true },\r
  safePlus: { label: 'a+', node: { t: 'plus', n: a }, evil: false },\r
};\r
`;export{e as default};