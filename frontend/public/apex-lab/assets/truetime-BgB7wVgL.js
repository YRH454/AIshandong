var e=`// TrueTime & commit-wait (Google Spanner) — how a globally-distributed database gives transactions a\r
// single, globally-consistent ordering using real clocks. The trick is to stop pretending the clock\r
// is exact. TrueTime's TT.now() returns an INTERVAL [earliest, latest] = [t−ε, t+ε]; the true instant\r
// is somewhere inside, with ε bounded (a few ms) by GPS + atomic clocks in every datacenter. To commit\r
// a transaction with external consistency — if T1 finishes before T2 begins, then ts(T1) < ts(T2) — a\r
// transaction picks its commit timestamp s = TT.now().latest (= t+ε, the latest it could possibly be)\r
// and then COMMIT-WAITs until TT.now().earliest > s before releasing its locks. That guarantees s is\r
// safely in the PAST everywhere, so no later transaction can ever pick an earlier timestamp. The wait\r
// is exactly 2ε — the price of correctness is paid in clock uncertainty. Pure model, tested.\r
\r
export interface TTInterval { earliest: number; latest: number }\r
\r
/** TT.now(): the bounded-uncertainty interval around the true instant. */\r
export const now = (trueTime: number, epsilon: number): TTInterval => ({ earliest: trueTime - epsilon, latest: trueTime + epsilon });\r
\r
export interface Commit {\r
  commitTs: number; // s = TT.now().latest = t + ε  (the latest the true time could be)\r
  waitMs: number; // commit-wait duration = 2ε\r
  visibleAt: number; // when locks release / the commit becomes visible = t + 2ε\r
}\r
\r
/** Choose a commit timestamp and compute the commit-wait needed to make it safely past. */\r
export function commitWait(trueTime: number, epsilon: number): Commit {\r
  return {\r
    commitTs: trueTime + epsilon, // pick the latest possible "now"\r
    waitMs: 2 * epsilon, // wait until TT.now().earliest > commitTs ⇒ trueTime + 2ε\r
    visibleAt: trueTime + 2 * epsilon,\r
  };\r
}\r
\r
export interface ECResult { ts1: number; ts2: number; t1VisibleAt: number; ordered: boolean }\r
\r
/** External consistency: T1 commits at true time t1, then T2 begins. With commit-wait, T2 can't start\r
 *  until T1 is visible (t1+2ε), so ts2 > ts1 always. Without it, T2 can grab an EQUAL (non-greater)\r
 *  timestamp despite happening after — and ts1 < ts2 fails, which is the anomaly commit-wait prevents. */\r
export function externalConsistency(t1: number, t2Start: number, epsilon: number, useCommitWait: boolean): ECResult {\r
  const c1 = commitWait(t1, epsilon);\r
  const ts1 = c1.commitTs;\r
  const t1VisibleAt = useCommitWait ? c1.visibleAt : t1; // without commit-wait, locks release immediately at t1\r
  const actualT2 = Math.max(t2Start, t1VisibleAt); // T2 observes T1 only once it is visible\r
  const ts2 = actualT2 + epsilon; // T2 picks its own latest-now\r
  return { ts1, ts2, t1VisibleAt, ordered: ts1 < ts2 };\r
}\r
`;export{e as default};