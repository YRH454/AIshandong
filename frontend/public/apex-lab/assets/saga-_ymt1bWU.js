var e=`// The Saga pattern — how microservices pull off a "transaction" across services that have separate\r
// databases, where a classic two-phase commit (holding locks across all of them) isn't an option. A saga\r
// is a sequence of local steps, each with a COMPENSATING action that semantically undoes it. Run the\r
// steps forward; if one fails, you can't roll back the ones already committed (they're durable in other\r
// services), so instead you run their compensations in REVERSE order — refund the charge, release the\r
// inventory — driving the system back to a consistent state. It trades atomic isolation for availability\r
// and eventual consistency: other observers can briefly see partial progress, and compensations must be\r
// idempotent and (ideally) always succeed. Orchestrated (a coordinator drives it) or choreographed\r
// (services react to each other's events). Reference: Garcia-Molina & Salem, "Sagas" (1987); microservices practice.\r
\r
export interface SagaStep { action: string; compensation: string }\r
export type EntryType = 'action' | 'compensate';\r
export interface LogEntry { type: EntryType; name: string; ok: boolean }\r
export interface SagaResult { log: LogEntry[]; outcome: 'committed' | 'rolled back'; completed: string[] }\r
\r
/** Run a saga; if \`failAt\` is a step index, that step's action fails and the prior steps are compensated\r
 *  in reverse order. \`failAt = null\` means every step succeeds. */\r
export function runSaga(steps: SagaStep[], failAt: number | null): SagaResult {\r
  const log: LogEntry[] = [];\r
  const completed: SagaStep[] = [];\r
  for (let i = 0; i < steps.length; i++) {\r
    if (i === failAt) {\r
      log.push({ type: 'action', name: steps[i].action, ok: false }); // this step failed\r
      for (let j = completed.length - 1; j >= 0; j--) log.push({ type: 'compensate', name: completed[j].compensation, ok: true }); // undo in reverse\r
      return { log, outcome: 'rolled back', completed: completed.map((s) => s.action) };\r
    }\r
    log.push({ type: 'action', name: steps[i].action, ok: true });\r
    completed.push(steps[i]);\r
  }\r
  return { log, outcome: 'committed', completed: completed.map((s) => s.action) };\r
}\r
`;export{e as default};