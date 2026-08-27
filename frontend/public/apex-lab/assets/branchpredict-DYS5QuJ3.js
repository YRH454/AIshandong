var e=`// Branch prediction — how a CPU guesses which way a branch will go BEFORE it knows, so the pipeline\r
// doesn't stall waiting for the condition. A wrong guess wastes the partially-filled pipeline (a\r
// misprediction penalty of ~15-20 cycles on a modern core), so accuracy matters enormously. The classic\r
// predictor is a 2-bit SATURATING COUNTER per branch: states strong-NT(0), weak-NT(1), weak-T(2),\r
// strong-T(3); predict taken when the counter is in a "taken" state, and nudge it toward the actual\r
// outcome. The 2 bits add hysteresis: one surprising outcome doesn't immediately flip the prediction,\r
// so a loop branch that's taken many times then falls through ONCE (the loop exit) only mispredicts\r
// once per loop instead of twice as a 1-bit predictor would. Reference: Smith 1981; Hennessy & Patterson.\r
\r
export type Predictor = '1bit' | '2bit';\r
export interface Step { actual: boolean; predicted: boolean; correct: boolean; stateBefore: number; stateAfter: number }\r
export interface PredictResult { steps: Step[]; mispredictions: number; accuracy: number }\r
\r
// 1-bit: state is just "what happened last time". 2-bit: a 0..3 saturating counter, predict T if >= 2.\r
const predictFrom = (kind: Predictor, state: number) => (kind === '1bit' ? state === 1 : state >= 2);\r
const update = (kind: Predictor, state: number, taken: boolean): number =>\r
  kind === '1bit'\r
    ? (taken ? 1 : 0)\r
    : Math.max(0, Math.min(3, state + (taken ? 1 : -1)));\r
\r
/** Run a predictor over a sequence of actual outcomes (true = branch taken). */\r
export function simulate(outcomes: boolean[], kind: Predictor, initial: number): PredictResult {\r
  let state = initial;\r
  let mispredictions = 0;\r
  const steps: Step[] = outcomes.map((actual) => {\r
    const predicted = predictFrom(kind, state);\r
    const correct = predicted === actual;\r
    if (!correct) mispredictions++;\r
    const stateBefore = state;\r
    state = update(kind, state, actual);\r
    return { actual, predicted, correct, stateBefore, stateAfter: state };\r
  });\r
  return { steps, mispredictions, accuracy: outcomes.length ? (outcomes.length - mispredictions) / outcomes.length : 1 };\r
}\r
\r
/** A loop branch: taken \`body\` times then a single fall-through (the exit), repeated \`iters\` times. */\r
export const loopPattern = (body: number, iters: number): boolean[] =>\r
  Array.from({ length: iters }, () => [...Array(body).fill(true), false]).flat();\r
`;export{e as default};