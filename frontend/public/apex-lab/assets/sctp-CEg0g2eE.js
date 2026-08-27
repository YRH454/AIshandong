var e=`// SCTP (RFC 9260, formerly RFC 4960) — the transport that survives a dead network path. A TCP connection is welded to\r
// one (source IP, dest IP) pair: if that path fails, the connection dies. An SCTP *association* binds\r
// MULTIPLE addresses on each endpoint (multi-homing); it sends on a primary path, probes every path\r
// with HEARTBEAT chunks, and on repeated failures marks a path INACTIVE and FAILS OVER to an alternate\r
// — the association lives on. It also opens with a 4-way COOKIE handshake so the server allocates no\r
// state until the client proves return-routability, making it immune to SYN-flood-style attacks.\r
// Two honest models here: the multi-homing failover state machine (RFC 9260 §8) and the cookie\r
// handshake sequence (§5.1). Tested against the RFC's error-counter rules.\r
\r
// ---- Multi-homing & path failover (RFC 9260 §8.1–8.3) ------------------------------------------\r
\r
export interface PathState { id: string; addr: string; errors: number; active: boolean }\r
\r
export interface SctpConfig {\r
  paths: { id: string; addr: string }[]; // configured destinations; the first is the initial primary\r
  pathMaxRetrans: number; // RFC default 5: a path goes INACTIVE once its error count EXCEEDS this\r
  assocMaxRetrans: number; // RFC default 10: the association fails once total errors EXCEED this\r
}\r
\r
export type SctpEvent =\r
  | { type: 'timeout'; path: string } // a HEARTBEAT/data retransmission timed out on this path\r
  | { type: 'ack'; path: string }; //    a HEARTBEAT-ACK / data ACK arrived on this path\r
\r
export interface SctpStep {\r
  n: number;\r
  event: string;\r
  desc: string;\r
  current: string | null; // the destination currently in use (primary if active, else first active alternate)\r
  states: PathState[];\r
  assocErrors: number;\r
  assoc: 'ESTABLISHED' | 'DOWN';\r
  failedOver: boolean; // did the current path change as a result of this event?\r
}\r
\r
export interface SctpRun {\r
  steps: SctpStep[];\r
  finalAssoc: 'ESTABLISHED' | 'DOWN';\r
  failovers: number; // number of times the active path changed\r
  endPath: string | null;\r
}\r
\r
/** The destination in use: the primary if active, otherwise the first active alternate (primary-preferred). */\r
function pick(states: PathState[]): string | null {\r
  const a = states.find((p) => p.active);\r
  return a ? a.id : null;\r
}\r
\r
export function runAssoc(cfg: SctpConfig, events: SctpEvent[]): SctpRun {\r
  const states: PathState[] = cfg.paths.map((p) => ({ id: p.id, addr: p.addr, errors: 0, active: true }));\r
  let assocErrors = 0;\r
  let assoc: 'ESTABLISHED' | 'DOWN' = 'ESTABLISHED';\r
  let current = pick(states);\r
  const steps: SctpStep[] = [];\r
  let failovers = 0;\r
\r
  const snap = (event: string, desc: string, failedOver: boolean) =>\r
    steps.push({ n: steps.length + 1, event, desc, current, states: states.map((s) => ({ ...s })), assocErrors, assoc, failedOver });\r
\r
  for (const e of events) {\r
    const p = states.find((s) => s.id === e.path);\r
    if (!p || assoc === 'DOWN') { snap(e.type, \`(ignored — \${assoc === 'DOWN' ? 'association is down' : 'unknown path'})\`, false); continue; }\r
    const before = current;\r
\r
    if (e.type === 'timeout') {\r
      p.errors += 1;\r
      assocErrors += 1;\r
      // RFC 9260 §8.1: association fails once the overall counter EXCEEDS Association.Max.Retrans\r
      if (assocErrors > cfg.assocMaxRetrans) {\r
        assoc = 'DOWN';\r
        states.forEach((s) => (s.active = false));\r
        current = null;\r
        snap('timeout', \`Timeout on \${p.id}: total errors \${assocErrors} > Association.Max.Retrans (\${cfg.assocMaxRetrans}) — peer unreachable, association DOWN\`, before !== current);\r
        continue;\r
      }\r
      // RFC 9260 §8.2/8.3: a path goes INACTIVE once its counter EXCEEDS Path.Max.Retrans\r
      let desc = \`Timeout on \${p.id}: path errors \${p.errors}/\${cfg.pathMaxRetrans}, assoc errors \${assocErrors}/\${cfg.assocMaxRetrans}\`;\r
      if (p.errors > cfg.pathMaxRetrans && p.active) {\r
        p.active = false;\r
        desc = \`Timeout on \${p.id}: errors \${p.errors} > Path.Max.Retrans (\${cfg.pathMaxRetrans}) — \${p.id} marked INACTIVE\`;\r
      }\r
      current = pick(states);\r
      const fo = before !== current && current !== null;\r
      if (fo) { failovers += 1; desc += \` → FAILOVER to \${current}\`; }\r
      snap('timeout', desc, fo);\r
    } else {\r
      // a successful ack clears that path's error counter and the association counter (RFC 9260 §8.1, §8.3)\r
      const wasInactive = !p.active;\r
      p.errors = 0;\r
      p.active = true;\r
      assocErrors = 0;\r
      current = pick(states);\r
      const fo = before !== current;\r
      if (fo) failovers += 1;\r
      const desc = wasInactive\r
        ? \`ACK on \${p.id}: error counter cleared, \${p.id} back ACTIVE\${fo ? \` → failback to \${current}\` : ''}\`\r
        : \`ACK on \${p.id}: error counters reset (path healthy)\`;\r
      snap('ack', desc, fo);\r
    }\r
  }\r
\r
  return { steps, finalAssoc: assoc, failovers, endPath: current };\r
}\r
\r
// ---- 4-way cookie handshake (RFC 9260 §5.1) ---------------------------------------------------\r
\r
export interface SctpChunk { n: number; from: 'client' | 'server'; chunk: string; carries: string; note: string }\r
\r
/** The association setup handshake. Unlike TCP's 3-way SYN, the server keeps NO state until the\r
 *  client echoes the signed cookie back — so a flood of INITs costs the server nothing. */\r
export function handshake(): SctpChunk[] {\r
  return [\r
    { n: 1, from: 'client', chunk: 'INIT', carries: 'Initiate Tag, a_rwnd, # outbound streams, list of the client’s IP addresses',\r
      note: 'The client proposes the association and advertises ALL of its addresses (multi-homing is negotiated up front).' },\r
    { n: 2, from: 'server', chunk: 'INIT-ACK', carries: 'Initiate Tag + a State Cookie (signed TCB: a MAC over all the state needed to set up the association)',\r
      note: 'The server allocates NO memory yet. It packs everything it would need into a self-authenticating cookie and sends it back — nothing to exhaust under a flood.' },\r
    { n: 3, from: 'client', chunk: 'COOKIE-ECHO', carries: 'the State Cookie, echoed back verbatim (may already piggyback DATA)',\r
      note: 'The client returns the cookie, proving it can receive at its claimed address (return-routability).' },\r
    { n: 4, from: 'server', chunk: 'COOKIE-ACK', carries: '(confirmation)',\r
      note: 'The server verifies the cookie’s MAC with its own secret, NOW builds the TCB, and the association is ESTABLISHED. State was created only after the client proved itself.' },\r
  ];\r
}\r
`;export{e as default};