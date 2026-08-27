var e=`// Fencing tokens — why a distributed lock alone can't protect a resource, and how a\r
// monotonically-increasing token fixes it (Martin Kleppmann's well-known example). A lock\r
// service hands a client exclusive access, but the client might pause (a long GC, a network\r
// stall) past its lease, during which the lock is granted to someone else. When the first\r
// client wakes it still "thinks" it holds the lock and writes — corrupting data. The fix:\r
// the lock service stamps each grant with an ever-increasing FENCING TOKEN, and the resource\r
// remembers the highest token it has accepted and REJECTS any write carrying a smaller one.\r
// So a resumed, stale client is fenced out. Pure model of the scenario, tested.\r
\r
export interface LockService { nextToken: number }\r
export const lockService = (): LockService => ({ nextToken: 1 });\r
export function acquire(ls: LockService): number { return ls.nextToken++; } // monotonic grants\r
\r
export interface Resource { highestToken: number; value: string | null; log: string[] }\r
export const resource = (): Resource => ({ highestToken: 0, value: null, log: [] });\r
\r
export interface WriteResult { accepted: boolean; reason: string }\r
\r
/** A guarded write: accepted only if its fencing token is ≥ the highest already seen. */\r
export function write(r: Resource, token: number, value: string, fencingOn = true): WriteResult {\r
  if (fencingOn && token < r.highestToken) {\r
    r.log.push(\`✗ token \${token} < \${r.highestToken} — REJECTED (stale)\`);\r
    return { accepted: false, reason: \`token \${token} is older than \${r.highestToken}\` };\r
  }\r
  r.highestToken = Math.max(r.highestToken, token);\r
  r.value = value;\r
  r.log.push(\`✓ token \${token} accepted → value = "\${value}"\`);\r
  return { accepted: true, reason: \`accepted at token \${token}\` };\r
}\r
\r
export interface Event { actor: string; token: number; value: string }\r
\r
/** The split-brain scenario: client A acquires, pauses; B acquires & writes; A resumes &\r
 *  writes with its now-stale token. Returns the resource state with and without fencing. */\r
export function splitBrainScenario(): { withFencing: Resource; withoutFencing: Resource; events: Event[] } {\r
  const ls = lockService();\r
  const tokenA = acquire(ls); // A gets 1, then pauses (long GC)\r
  const tokenB = acquire(ls); // lease expired → B gets 2 and proceeds\r
  const events: Event[] = [\r
    { actor: 'Client B', token: tokenB, value: 'B-data' }, // B writes first (A is paused)\r
    { actor: 'Client A (resumed, stale)', token: tokenA, value: 'A-data' }, // A wakes up and writes\r
  ];\r
  const withFencing = resource(), withoutFencing = resource();\r
  for (const e of events) { write(withFencing, e.token, e.value, true); write(withoutFencing, e.token, e.value, false); }\r
  return { withFencing, withoutFencing, events };\r
}\r
`;export{e as default};