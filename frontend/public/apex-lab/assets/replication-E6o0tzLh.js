var e=`// Write-ahead-log replication — how a database keeps copies in sync and survives a\r
// crash. The leader appends every change to an ordered log; each follower copies\r
// entries in order, lagging by some amount. The commit point is the highest entry\r
// stored on a QUORUM (majority). The durability knob:\r
//   SYNC  — a write isn't acknowledged to the client until a majority has it, so an\r
//           ack'd write can never be lost (durable), but the client waits for replicas.\r
//   ASYNC — the leader commits immediately and replicates lazily (fast), but if the\r
//           leader crashes, any entries the followers hadn't copied yet are LOST.\r
// On failover, the new leader is the most up-to-date follower; entries beyond it\r
// vanish. Pure, deterministic model. Tested.\r
\r
export type Mode = 'sync' | 'async';\r
\r
export interface ReplState {\r
  mode: Mode;\r
  log: string[]; // the leader's ordered log entries (index 0..n-1)\r
  followers: number[]; // each follower's replicatedIndex = # of entries it has copied\r
  ackedIndex: number; // # of entries acknowledged to the client (durable promise)\r
}\r
\r
export function initRepl(mode: Mode, followerCount = 2): ReplState {\r
  return { mode, log: [], followers: new Array(followerCount).fill(0), ackedIndex: 0 };\r
}\r
\r
/** Quorum over (leader + followers): a majority of the whole replica set. */\r
export function quorum(followerCount: number): number {\r
  return Math.floor((followerCount + 1) / 2) + 1;\r
}\r
\r
/** The commit index = how many entries are stored on a quorum of replicas. */\r
export function commitIndex(s: ReplState): number {\r
  const n = s.log.length;\r
  for (let idx = n; idx >= 1; idx--) {\r
    // replicas that have at least \`idx\` entries: the leader (always) + matching followers\r
    const have = 1 + s.followers.filter((f) => f >= idx).length;\r
    if (have >= quorum(s.followers.length)) return idx;\r
  }\r
  return 0;\r
}\r
\r
/** Leader appends an entry. Under async it's immediately acked; under sync, not yet. */\r
export function append(s: ReplState, entry: string): ReplState {\r
  const log = [...s.log, entry];\r
  const next = { ...s, log };\r
  // async acknowledges on the leader right away; sync waits for the quorum (see ackUpToCommit)\r
  return s.mode === 'async' ? { ...next, ackedIndex: log.length } : next;\r
}\r
\r
/** A follower copies one more entry from the leader (advances its replicatedIndex). */\r
export function replicateOne(s: ReplState, follower: number): ReplState {\r
  const followers = s.followers.slice();\r
  if (followers[follower] < s.log.length) followers[follower] += 1;\r
  const next = { ...s, followers };\r
  return refreshAck(next);\r
}\r
\r
/** Replicate every follower fully up to the leader's log (a catch-up round). */\r
export function replicateAll(s: ReplState): ReplState {\r
  const followers = s.followers.map(() => s.log.length);\r
  return refreshAck({ ...s, followers });\r
}\r
\r
/** Under sync, the acked index follows the commit index (quorum durability). */\r
function refreshAck(s: ReplState): ReplState {\r
  if (s.mode === 'sync') return { ...s, ackedIndex: Math.max(s.ackedIndex, commitIndex(s)) };\r
  return s;\r
}\r
\r
export interface FailoverResult {\r
  newLeaderFollower: number; // which follower is promoted (most up-to-date)\r
  survivedIndex: number; // entries that survive (the new leader's log length)\r
  lost: string[]; // entries that existed on the old leader but are gone\r
  ackedLost: boolean; // did we lose anything that had been acknowledged? (sync must be false)\r
}\r
\r
/** The leader crashes: the most up-to-date follower takes over; the tail beyond it is lost. */\r
export function leaderCrashes(s: ReplState): FailoverResult {\r
  const best = s.followers.reduce((bi, f, i) => (f > s.followers[bi] ? i : bi), 0);\r
  const survivedIndex = s.followers[best];\r
  const lost = s.log.slice(survivedIndex);\r
  return {\r
    newLeaderFollower: best,\r
    survivedIndex,\r
    lost,\r
    ackedLost: survivedIndex < s.ackedIndex, // SYNC guarantees this is never true\r
  };\r
}\r
`;export{e as default};