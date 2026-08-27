var e=`// Write-Ahead Logging (WAL) — how a database survives a crash mid-transaction (the redo/undo heart\r
// of ARIES-style recovery). The rule: before a change touches a data page, its log record is appended to a\r
// sequential, fsync'd log. So the log is the source of truth. After a crash, recovery reads\r
// the log and does two things: REDO every change made by a transaction that has a COMMIT\r
// record (durability — committed work is never lost), and UNDO every change by a\r
// transaction that doesn't (atomicity — a half-done transaction leaves no trace). The data\r
// pages themselves may have been flushed or not; the log makes the outcome deterministic.\r
// Pure recovery model — the redo/undo essence; ARIES's checkpointing and LSN-based dirty-page\r
// tracking (which bound how far back replay must start) are out of scope here. Tested.\r
\r
export type Rec =\r
  | { lsn: number; txid: number; type: 'update'; key: string; before: string; after: string }\r
  | { lsn: number; txid: number; type: 'commit' };\r
\r
export interface Recovery {\r
  final: Record<string, string>;\r
  committed: number[];\r
  aborted: number[];     // present in the log but never committed\r
  redone: Rec[];\r
  undone: Rec[];\r
}\r
\r
/** Truncate the log at a crash point — records after \`crashLsn\` never reached durable storage. */\r
export const crashAt = (log: Rec[], crashLsn: number): Rec[] => log.filter((r) => r.lsn <= crashLsn);\r
\r
/** Recover a consistent state from the surviving log. */\r
export function recover(log: Rec[], initial: Record<string, string>): Recovery {\r
  const ordered = [...log].sort((a, b) => a.lsn - b.lsn); // replay strictly in LSN order, not array order\r
  const committed = new Set(ordered.filter((r) => r.type === 'commit').map((r) => r.txid));\r
  const updates = ordered.filter((r): r is Extract<Rec, { type: 'update' }> => r.type === 'update');\r
\r
  const final: Record<string, string> = { ...initial };\r
  const redone: Rec[] = [];\r
  // REDO: apply committed updates in log order (last committed write to a key wins)\r
  for (const u of updates) if (committed.has(u.txid)) { final[u.key] = u.after; redone.push(u); }\r
  // UNDO: a key touched ONLY by uncommitted txns reverts to its pre-image (its original value)\r
  const undone = updates.filter((u) => !committed.has(u.txid));\r
  for (const u of [...undone].reverse()) {\r
    const everCommitted = updates.some((v) => v.key === u.key && committed.has(v.txid));\r
    if (!everCommitted) final[u.key] = initial[u.key] ?? u.before;\r
  }\r
\r
  const aborted = [...new Set(updates.map((u) => u.txid))].filter((t) => !committed.has(t));\r
  return { final, committed: [...committed], aborted, redone, undone };\r
}\r
`;export{e as default};