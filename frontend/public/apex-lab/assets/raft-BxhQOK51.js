var e=`// Raft leader election — how a cluster agrees on ONE leader despite no shared\r
// clock and unreliable timing. Each node is a follower, candidate, or leader and\r
// tracks a monotonically increasing \`term\`. When a follower's election timer fires\r
// it becomes a candidate: it bumps its term, votes for itself, and sends RequestVote\r
// to everyone. A node grants its vote at most ONCE per term, to the first candidate\r
// whose term ≥ its own. A majority of votes makes a candidate the leader; a split\r
// vote elects no one and a new, higher-term election follows. Seeing a higher term\r
// always demotes you to follower. Deterministic model (Raft, Ongaro & Ousterhout).\r
\r
export type Role = 'follower' | 'candidate' | 'leader';\r
export interface Node {\r
  id: number;\r
  role: Role;\r
  term: number;\r
  votedFor: number | null; // who this node voted for in its current term\r
}\r
\r
export const majority = (n: number) => Math.floor(n / 2) + 1;\r
\r
export function initCluster(n: number): Node[] {\r
  return Array.from({ length: n }, (_, id) => ({ id, role: 'follower', term: 0, votedFor: null }));\r
}\r
\r
export interface VoteRequest { candidate: number; term: number }\r
\r
/** RequestVote receiver rule: grant iff term ≥ ours AND we haven't voted this term. */\r
export function handleRequestVote(node: Node, req: VoteRequest): { granted: boolean; node: Node } {\r
  // a higher term always updates us and resets our vote\r
  let n = node;\r
  if (req.term > n.term) n = { ...n, term: req.term, role: 'follower', votedFor: null };\r
  if (req.term < n.term) return { granted: false, node: n }; // stale candidate\r
  if (n.votedFor === null || n.votedFor === req.candidate) {\r
    return { granted: true, node: { ...n, votedFor: req.candidate, term: req.term } };\r
  }\r
  return { granted: false, node: n }; // already voted for someone else this term\r
}\r
\r
export interface ElectionResult {\r
  nodes: Node[];\r
  candidate: number;\r
  term: number;\r
  votes: number[]; // ids that granted the vote (incl. the candidate itself)\r
  outcome: 'leader' | 'split';\r
}\r
\r
/**\r
 * Run one full election started by \`starter\`: it becomes a candidate at a new term,\r
 * everyone votes per the rules, and we tally. The \`participating\` predicate lets a\r
 * test/UI model crashed or partitioned nodes that don't respond.\r
 */\r
export function runElection(nodes: Node[], starter: number, participating: (id: number) => boolean = () => true): ElectionResult {\r
  const n = nodes.length;\r
  const term = Math.max(...nodes.map((x) => x.term)) + 1; // a fresh, higher term\r
  let cluster = nodes.map((x) => ({ ...x }));\r
\r
  // candidate transitions and votes for itself\r
  cluster[starter] = { ...cluster[starter], role: 'candidate', term, votedFor: starter };\r
  const votes = [starter];\r
\r
  // request votes from every other node that is reachable/alive\r
  for (let i = 0; i < n; i++) {\r
    if (i === starter || !participating(i)) continue;\r
    const res = handleRequestVote(cluster[i], { candidate: starter, term });\r
    cluster[i] = res.node;\r
    if (res.granted) votes.push(i);\r
  }\r
\r
  const won = votes.length >= majority(n);\r
  if (won) {\r
    cluster[starter] = { ...cluster[starter], role: 'leader' };\r
    // followers learn of the leader via heartbeats (adopt the term, drop candidacy)\r
    cluster = cluster.map((x) => (x.id === starter ? x : { ...x, role: 'follower', term }));\r
  }\r
  return { nodes: cluster, candidate: starter, term, votes, outcome: won ? 'leader' : 'split' };\r
}\r
\r
export interface RaceResult {\r
  nodes: Node[];\r
  term: number;\r
  tallies: Record<number, number[]>; // candidate id → voter ids (incl. itself)\r
  outcome: 'leader' | 'split';\r
  leader: number | null;\r
}\r
\r
/**\r
 * Two (or more) candidates campaign in the SAME term — the classic split-vote case.\r
 * Each non-candidate node is asked by the candidates in a rotated order (so first-\r
 * dibs spreads around), and grants to the first valid asker. Without a majority,\r
 * the term ends with no leader. Deterministic.\r
 */\r
export function runRace(nodes: Node[], candidates: number[]): RaceResult {\r
  const n = nodes.length;\r
  const term = Math.max(...nodes.map((x) => x.term)) + 1;\r
  const cluster = nodes.map((x) => ({ ...x }));\r
  const tallies: Record<number, number[]> = {};\r
  for (const c of candidates) { cluster[c] = { ...cluster[c], role: 'candidate', term, votedFor: c }; tallies[c] = [c]; }\r
\r
  for (let i = 0; i < n; i++) {\r
    if (candidates.includes(i)) continue;\r
    const order = candidates.slice(i % candidates.length).concat(candidates.slice(0, i % candidates.length));\r
    for (const c of order) {\r
      const res = handleRequestVote(cluster[i], { candidate: c, term });\r
      cluster[i] = res.node;\r
      if (res.granted) { tallies[c].push(i); break; }\r
    }\r
  }\r
\r
  let leader: number | null = null;\r
  for (const c of candidates) if (tallies[c].length >= majority(n)) leader = c;\r
  if (leader !== null) {\r
    for (let i = 0; i < n; i++) cluster[i] = i === leader ? { ...cluster[i], role: 'leader' } : { ...cluster[i], role: 'follower', term };\r
  }\r
  return { nodes: cluster, term, tallies, outcome: leader !== null ? 'leader' : 'split', leader };\r
}\r
\r
/** A leader that receives a message from a higher term steps down to follower. */\r
export function onHigherTerm(node: Node, term: number): Node {\r
  return term > node.term ? { ...node, role: 'follower', term, votedFor: null } : node;\r
}\r
`;export{e as default};