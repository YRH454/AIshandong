var e=`// Raft log replication (Ongaro & Ousterhout, "In Search of an Understandable Consensus Algorithm",\r
// §5.3–5.4) — how an elected leader makes every follower's log identical, and decides when an entry is\r
// safely COMMITTED. Three ideas:\r
//   • Log Matching: AppendEntries carries (prevLogIndex, prevLogTerm). A follower accepts only if its\r
//     log has that entry — proving the two logs agree up to that point. If not, it rejects, and the\r
//     leader BACKS UP nextIndex and retries until a match is found, then overwrites the follower's\r
//     divergent suffix. So agreement at the tip implies agreement on the whole prefix.\r
//   • Commit by majority: the leader advances commitIndex to N once a MAJORITY of logs hold entry N.\r
//   • The §5.4.2 safety rule: a leader may only commit entries from its OWN current term by counting\r
//     replicas. A leftover entry from a previous term is committed only INDIRECTLY, once a current-term\r
//     entry above it commits — this is the subtle fix for the Figure-8 anomaly where a majority-stored\r
//     entry could otherwise be overwritten. Pure model of the log mechanics, tested against the paper.\r
\r
export interface Entry { term: number; cmd: string }\r
\r
export interface AppendResult { ok: boolean; log: Entry[]; reason: string }\r
\r
/** AppendEntries log-matching check + append (§5.3). prevLogIndex = -1 means "from the start". */\r
export function appendEntries(followerLog: Entry[], prevLogIndex: number, prevLogTerm: number, entries: Entry[]): AppendResult {\r
  if (prevLogIndex >= 0) {\r
    if (followerLog.length <= prevLogIndex || followerLog[prevLogIndex].term !== prevLogTerm) {\r
      return { ok: false, log: followerLog, reason: \`no entry matching index \${prevLogIndex}/term \${prevLogTerm} → reject\` };\r
    }\r
  }\r
  const merged = followerLog.slice(0, prevLogIndex + 1); // drop any conflicting suffix\r
  for (const e of entries) merged.push(e);\r
  return { ok: true, log: merged, reason: 'log-matching passed → appended (divergent suffix overwritten)' };\r
}\r
\r
export interface SyncResult { log: Entry[]; nextIndexTried: number[]; rounds: number }\r
\r
/** Bring one follower into sync: start optimistically at the leader's tip and back nextIndex up on each\r
 *  rejection until the consistency check passes, then replicate the rest (§5.3). */\r
export function syncFollower(leaderLog: Entry[], followerLog: Entry[]): SyncResult {\r
  const nextIndexTried: number[] = [];\r
  let nextIndex = leaderLog.length;\r
  for (let attempt = 0; attempt <= leaderLog.length + 1; attempt++) {\r
    const prevLogIndex = nextIndex - 1;\r
    const prevLogTerm = prevLogIndex >= 0 ? leaderLog[prevLogIndex].term : 0;\r
    nextIndexTried.push(nextIndex);\r
    const r = appendEntries(followerLog, prevLogIndex, prevLogTerm, leaderLog.slice(nextIndex));\r
    if (r.ok) return { log: r.log, nextIndexTried, rounds: attempt + 1 };\r
    nextIndex--;\r
  }\r
  return { log: followerLog, nextIndexTried, rounds: -1 };\r
}\r
\r
/** The highest index the leader may mark committed: a MAJORITY hold it AND it is from the current term\r
 *  (§5.4.2). Everything at or below that index is then committed by the Log Matching property. */\r
export function commitIndex(logs: Entry[][], currentTerm: number): number {\r
  const majority = Math.floor(logs.length / 2) + 1;\r
  const leaderLog = logs[0];\r
  let commit = -1;\r
  for (let i = 0; i < leaderLog.length; i++) {\r
    if (leaderLog[i].term !== currentTerm) continue; // may NOT commit prior-term entries by counting\r
    const replicas = logs.filter((lg) => lg.length > i && lg[i].term === leaderLog[i].term).length;\r
    if (replicas >= majority) commit = i;\r
  }\r
  return commit;\r
}\r
`;export{e as default};