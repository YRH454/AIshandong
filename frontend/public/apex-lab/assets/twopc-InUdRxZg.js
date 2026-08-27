var e=`// Two-phase commit (2PC) — how a coordinator makes several databases commit a\r
// transaction atomically (all or nothing). PHASE 1 (prepare/voting): the coordinator\r
// asks every participant to PREPARE; each votes YES (durably prepared, holding its\r
// locks) or NO. PHASE 2 (decision): if EVERY vote is YES the coordinator decides\r
// COMMIT and tells everyone; if any voted NO it decides ABORT. Every participant must\r
// obey the decision. The fatal flaw: if the coordinator crashes AFTER participants\r
// prepared but BEFORE broadcasting the decision, those participants are IN-DOUBT —\r
// stuck holding locks, unable to commit or abort on their own (2PC is blocking).\r
// Pure, deterministic model. Tested.\r
\r
export type Phase = 'idle' | 'preparing' | 'committing' | 'aborting' | 'done' | 'blocked';\r
export type PState = 'working' | 'prepared' | 'committed' | 'aborted' | 'in-doubt';\r
export type Vote = 'yes' | 'no';\r
\r
export interface Participant { id: number; vote: Vote; state: PState }\r
export interface TwoPC {\r
  phase: Phase;\r
  participants: Participant[];\r
  decision: 'commit' | 'abort' | null;\r
  coordinatorAlive: boolean;\r
}\r
\r
/** \`votes[i]\` is how participant i will vote when asked to prepare. */\r
export function init2pc(votes: Vote[]): TwoPC {\r
  return {\r
    phase: 'idle',\r
    participants: votes.map((v, id) => ({ id, vote: v, state: 'working' })),\r
    decision: null,\r
    coordinatorAlive: true,\r
  };\r
}\r
\r
/** PHASE 1: the coordinator sends PREPARE; each participant votes and moves state. */\r
export function prepare(s: TwoPC): TwoPC {\r
  const participants = s.participants.map((p) => ({ ...p, state: (p.vote === 'yes' ? 'prepared' : 'aborted') as PState }));\r
  return { ...s, phase: 'preparing', participants };\r
}\r
\r
/** Decide based on the collected votes: unanimous YES → commit, otherwise abort. */\r
export function decide(s: TwoPC): TwoPC {\r
  const allYes = s.participants.every((p) => p.vote === 'yes');\r
  return { ...s, decision: allYes ? 'commit' : 'abort', phase: allYes ? 'committing' : 'aborting' };\r
}\r
\r
/** PHASE 2: deliver the decision; participants apply it and release locks. */\r
export function applyDecision(s: TwoPC): TwoPC {\r
  if (s.decision === null) return s;\r
  const participants = s.participants.map((p) => {\r
    if (s.decision === 'commit') return { ...p, state: 'committed' as PState };\r
    return { ...p, state: 'aborted' as PState }; // a NO voter is already aborted; others abort too\r
  });\r
  return { ...s, phase: 'done', participants };\r
}\r
\r
/**\r
 * The coordinator crashes. Participants that had voted YES and prepared but never\r
 * heard the decision are now IN-DOUBT — blocked, holding locks. (If the decision\r
 * had already been delivered, they keep it; a NO voter already aborted unilaterally.)\r
 */\r
export function crashCoordinator(s: TwoPC): TwoPC {\r
  if (s.phase === 'done') return { ...s, coordinatorAlive: false }; // decision already out\r
  const participants = s.participants.map((p) => (p.state === 'prepared' ? { ...p, state: 'in-doubt' as PState } : p));\r
  return { ...s, coordinatorAlive: false, phase: 'blocked', participants };\r
}\r
\r
/** Did the transaction reach a clean atomic outcome (all committed or all aborted)? */\r
export function outcome(s: TwoPC): 'committed' | 'aborted' | 'blocked' | 'pending' {\r
  if (s.participants.some((p) => p.state === 'in-doubt')) return 'blocked';\r
  if (s.phase !== 'done') return 'pending';\r
  return s.decision === 'commit' ? 'committed' : 'aborted';\r
}\r
`;export{e as default};