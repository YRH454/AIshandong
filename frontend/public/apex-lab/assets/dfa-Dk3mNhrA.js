var e=`// Deterministic Finite Automaton (DFA) — the simplest computer: a fixed set of states, one\r
// current state, and a transition table that says, for the current state and the next input\r
// symbol, which state to move to. After reading the whole input, you ACCEPT if you landed in\r
// an accepting state, else REJECT. With no memory beyond the current state, a DFA recognizes\r
// exactly the "regular" languages — which is plenty: it's the engine inside lexers, regex\r
// matchers, protocol state machines, and input validators. The classic surprise is that\r
// "is this binary number divisible by 3?" is a 3-state DFA (the states ARE the remainder).\r
// Pure, tested against the arithmetic it encodes.\r
\r
export interface Dfa {\r
  states: string[];\r
  alphabet: string[];\r
  start: string;\r
  accept: Set<string>;\r
  delta: Record<string, Record<string, string>>; // state → symbol → state\r
}\r
\r
export interface Run { path: string[]; accepted: boolean; rejectedAt: number | null }\r
\r
/** Run the DFA over \`input\`, recording the state after each symbol. */\r
export function run(dfa: Dfa, input: string): Run {\r
  const path = [dfa.start];\r
  let state = dfa.start;\r
  for (let i = 0; i < input.length; i++) {\r
    const next = dfa.delta[state]?.[input[i]];\r
    if (next === undefined) return { path, accepted: false, rejectedAt: i }; // no transition → stuck/reject\r
    state = next; path.push(state);\r
  }\r
  return { path, accepted: dfa.accept.has(state), rejectedAt: null };\r
}\r
\r
/** DFA accepting binary strings whose value is divisible by \`m\` (states = remainder mod m). */\r
export function divisibleBy(m: number): Dfa {\r
  const states = Array.from({ length: m }, (_, r) => \`r\${r}\`);\r
  const delta: Dfa['delta'] = {};\r
  for (let r = 0; r < m; r++) {\r
    delta[\`r\${r}\`] = { '0': \`r\${(r * 2) % m}\`, '1': \`r\${(r * 2 + 1) % m}\` }; // appending a bit: r → 2r+bit\r
  }\r
  return { states, alphabet: ['0', '1'], start: 'r0', accept: new Set(['r0']), delta };\r
}\r
\r
/** DFA accepting strings over {a,b} that CONTAIN the substring "ab". */\r
export function containsAB(): Dfa {\r
  return {\r
    states: ['start', 'sawA', 'done'],\r
    alphabet: ['a', 'b'],\r
    start: 'start',\r
    accept: new Set(['done']),\r
    delta: {\r
      start: { a: 'sawA', b: 'start' },\r
      sawA: { a: 'sawA', b: 'done' },\r
      done: { a: 'done', b: 'done' },\r
    },\r
  };\r
}\r
`;export{e as default};