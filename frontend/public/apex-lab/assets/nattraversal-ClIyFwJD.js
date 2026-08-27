var e=`// NAT traversal — how two peers behind NATs (e.g. a WebRTC call) find a path to each\r
// other. ICE gathers CANDIDATES for each peer: HOST (its LAN ip:port), SERVER-REFLEXIVE\r
// (its public ip:port, discovered by asking a STUN server "what address do you see?"),\r
// and RELAY (a TURN-server allocation that forwards traffic). The peers exchange\r
// candidate lists and run CONNECTIVITY CHECKS on pairs, preferring direct paths:\r
//   host↔host    — works only if both peers are on the same LAN.\r
//   srflx↔srflx  — direct hole-punching via STUN; works if BOTH NATs are cone-type,\r
//                  but FAILS if either is symmetric (it picks a new public port per\r
//                  destination, so the address the peer was told is already wrong).\r
//   relay (TURN) — always works, but every packet detours through the relay.\r
// ICE picks the highest-priority pair that works. Pure, deterministic model. Tested.\r
\r
export type NatType = 'open' | 'cone' | 'symmetric';\r
export type CandType = 'host' | 'srflx' | 'relay';\r
\r
export interface Peer { name: string; nat: NatType; lan: string; sameLanAs?: string }\r
export interface Candidate { type: CandType; priority: number; addr: string }\r
\r
const PRIORITY: Record<CandType, number> = { host: 126, srflx: 100, relay: 0 };\r
\r
/** Gather this peer's ICE candidates (host always; srflx unless open; relay always). */\r
export function gather(peer: Peer): Candidate[] {\r
  const out: Candidate[] = [{ type: 'host', priority: PRIORITY.host, addr: \`\${peer.lan} (LAN)\` }];\r
  if (peer.nat !== 'open') out.push({ type: 'srflx', priority: PRIORITY.srflx, addr: \`public:\${peer.name} (via STUN)\` });\r
  out.push({ type: 'relay', priority: PRIORITY.relay, addr: \`TURN/\${peer.name}\` });\r
  return out.sort((a, b) => b.priority - a.priority);\r
}\r
\r
/** Does a candidate pair of the given type actually connect, for these two peers? */\r
export function pairWorks(type: CandType, a: Peer, b: Peer): boolean {\r
  if (type === 'host') return a.lan === b.lan || a.sameLanAs === b.name || b.sameLanAs === a.name;\r
  if (type === 'srflx') {\r
    // direct hole-punching needs predictable public ports → both NATs must be cone\r
    // (open peers have a public address directly, which also works).\r
    const ok = (n: NatType) => n === 'cone' || n === 'open';\r
    return ok(a.nat) && ok(b.nat);\r
  }\r
  return true; // relay (TURN) always works\r
}\r
\r
export interface CheckStep { type: CandType; works: boolean; reason: string }\r
export interface IceResult {\r
  candidatesA: Candidate[];\r
  candidatesB: Candidate[];\r
  checks: CheckStep[];\r
  selected: CandType | null; // the chosen pair type (null = no connection possible)\r
  relayed: boolean; // did we fall back to a TURN relay?\r
}\r
\r
/** Run ICE between two peers: gather, then check pairs in priority order, pick the first that works. */\r
export function negotiate(a: Peer, b: Peer): IceResult {\r
  const order: CandType[] = ['host', 'srflx', 'relay'];\r
  const checks: CheckStep[] = [];\r
  let selected: CandType | null = null;\r
  for (const type of order) {\r
    const works = pairWorks(type, a, b);\r
    checks.push({ type, works, reason: reasonFor(type, works, a, b) });\r
    if (works && selected === null) selected = type;\r
  }\r
  return {\r
    candidatesA: gather(a),\r
    candidatesB: gather(b),\r
    checks,\r
    selected,\r
    relayed: selected === 'relay',\r
  };\r
}\r
\r
function reasonFor(type: CandType, works: boolean, a: Peer, b: Peer): string {\r
  if (type === 'host') return works ? 'both peers share a LAN — connect directly' : 'peers are on different networks';\r
  if (type === 'srflx') {\r
    if (works) return 'both NATs are cone-type → STUN hole-punching succeeds (direct, no relay)';\r
    const culprit = a.nat === 'symmetric' ? a.name : b.name;\r
    return \`\${culprit} is behind a SYMMETRIC NAT — its public port changes per destination, so hole-punching fails\`;\r
  }\r
  return 'TURN relay forwards the media — always works, but adds a hop';\r
}\r
`;export{e as default};