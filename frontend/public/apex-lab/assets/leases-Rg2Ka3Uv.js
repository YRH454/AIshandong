var e=`// Leases — a lock with an expiry date, so a crashed holder doesn't freeze the system forever. Instead of "hold\r
// this lock until you explicitly release it" (and if you die, everyone waits), a lease says "you're the leader\r
// for the next D seconds; after that it's automatically up for grabs." No cleanup needed when a node crashes —\r
// the lease just expires. This is how leader election stays live in Chubby, ZooKeeper, GFS chunk leases, and\r
// Raft/etcd leader leases. The catch is SAFETY: you must never have two nodes both believing they hold the\r
// lease at the same wall-clock instant (split brain — two leaders, two writers, corruption). And that depends\r
// on CLOCKS. If the current holder's clock runs slow, it thinks its lease is still valid after the granter has\r
// already declared it expired and handed a fresh lease to someone else — an overlap where BOTH act as leader.\r
// The defense is a guard interval: the granter waits out the maximum possible clock skew (plus message delay)\r
// before re-granting, so the old holder has provably self-expired first. This file models exactly that\r
// safety condition. Reference: Gray & Cheriton, "Leases" (1989); the Chubby & Raft lease designs.\r
\r
export interface LeaseParams {\r
  duration: number;   // lease length D (granter's clock)\r
  clockSkew: number;  // how much the holder's clock lags real time → how long it over-holds\r
  netDelay: number;   // grant/renew message delay the holder may fail to subtract\r
  guardInterval: number; // extra time the granter waits after expiry before re-granting\r
}\r
\r
export interface LeaseResult {\r
  granterExpiry: number;       // when the granter considers the lease done\r
  holderBelievesUntil: number; // when the OLD holder actually stops acting (its clock is slow / delay)\r
  newGrantAt: number;          // when the granter hands the lease to the next node\r
  overlap: number;             // wall-clock time during which BOTH think they hold it (0 = safe)\r
  safe: boolean;\r
}\r
\r
/** Analyze a lease hand-off on a common (true) timeline where t=0 is the original grant. */\r
export function analyze(p: LeaseParams): LeaseResult {\r
  const granterExpiry = p.duration;\r
  // the holder over-holds by its clock skew plus any message delay it didn't account for\r
  const holderBelievesUntil = p.duration + p.clockSkew + p.netDelay;\r
  const newGrantAt = p.duration + p.guardInterval; // granter waits the guard before re-granting\r
  const overlap = Math.max(0, holderBelievesUntil - newGrantAt);\r
  return { granterExpiry, holderBelievesUntil, newGrantAt, overlap, safe: overlap === 0 };\r
}\r
\r
/** The smallest guard interval that guarantees no split brain for these skew/delay assumptions. */\r
export const minSafeGuard = (p: Pick<LeaseParams, 'clockSkew' | 'netDelay'>): number => p.clockSkew + p.netDelay;\r
`;export{e as default};