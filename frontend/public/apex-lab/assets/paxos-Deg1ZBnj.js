var e=`// Single-decree Paxos (Lamport, "Paxos Made Simple"). A cluster of acceptors agrees on\r
// ONE value despite failures, using two phases. Phase 1 (Prepare/Promise): a proposer\r
// picks a ballot number n and asks acceptors to promise not to accept anything below n;\r
// each promise reports the highest-numbered value that acceptor has already accepted.\r
// Phase 2 (Accept/Accepted): with a majority of promises, the proposer must propose the\r
// highest already-accepted value it heard (or its own if none), and a value is CHOSEN\r
// once a majority accept it. The safety magic: any later, higher ballot is forced to\r
// re-propose the chosen value, because its promise-majority and the accept-majority must\r
// overlap. Pure model; the safety property is what the tests pin down.\r
\r
export interface AcceptorSnap { id: number; promised: number; acceptedN: number | null; acceptedV: string | null }\r
export type Phase = 'prepare' | 'promise' | 'accept' | 'accepted' | 'decision' | 'fail';\r
\r
export interface Step {\r
  proposer: string;\r
  n: number;\r
  phase: Phase;\r
  value?: string;\r
  text: string;\r
  responders?: number[]; // acceptor ids that answered positively\r
  acceptors: AcceptorSnap[];\r
  chosen: string | null;\r
}\r
\r
export interface Proposal { proposer: string; n: number; preferred: string }\r
\r
export interface PaxosRun { steps: Step[]; chosen: string | null }\r
\r
export function runPaxos(acceptorCount: number, proposals: Proposal[]): PaxosRun {\r
  const acc = Array.from({ length: acceptorCount }, (_, id) => ({ id, promised: 0, acceptedN: null as number | null, acceptedV: null as string | null }));\r
  const majority = Math.floor(acceptorCount / 2) + 1;\r
  const steps: Step[] = [];\r
  let chosen: string | null = null;\r
  const snap = (): AcceptorSnap[] => acc.map((a) => ({ ...a }));\r
\r
  for (const p of proposals) {\r
    // ── Phase 1: Prepare ──\r
    steps.push({ proposer: p.proposer, n: p.n, phase: 'prepare', text: \`\${p.proposer} broadcasts Prepare(\${p.n})\`, acceptors: snap(), chosen });\r
    const promises: { id: number; acceptedN: number | null; acceptedV: string | null }[] = [];\r
    for (const a of acc) {\r
      if (p.n > a.promised) { a.promised = p.n; promises.push({ id: a.id, acceptedN: a.acceptedN, acceptedV: a.acceptedV }); }\r
    }\r
    const promisers = promises.map((x) => x.id);\r
    steps.push({\r
      proposer: p.proposer, n: p.n, phase: 'promise', responders: promisers,\r
      text: promises.length >= majority\r
        ? \`\${promises.length}/\${acceptorCount} promise — a majority (need \${majority})\`\r
        : \`only \${promises.length}/\${acceptorCount} promise — no majority, \${p.proposer} stalls\`,\r
      acceptors: snap(), chosen,\r
    });\r
    if (promises.length < majority) {\r
      steps.push({ proposer: p.proposer, n: p.n, phase: 'fail', text: \`\${p.proposer}'s ballot \${p.n} fails (a higher ballot already promised away the acceptors)\`, acceptors: snap(), chosen });\r
      continue;\r
    }\r
\r
    // ── choose the value: highest already-accepted value heard, else the proposer's own ──\r
    let value = p.preferred, adopted = false;\r
    let best = -1;\r
    for (const pr of promises) if (pr.acceptedN !== null && pr.acceptedN > best) { best = pr.acceptedN; value = pr.acceptedV!; adopted = true; }\r
    steps.push({\r
      proposer: p.proposer, n: p.n, phase: 'accept', value,\r
      text: adopted\r
        ? \`must re-propose the highest accepted value it heard: "\${value}" (ballot \${best}) — not its own "\${p.preferred}"\`\r
        : \`no value accepted yet — free to propose its own "\${value}". Sends Accept(\${p.n}, "\${value}")\`,\r
      acceptors: snap(), chosen,\r
    });\r
\r
    // ── Phase 2: Accept ──\r
    const accepters: number[] = [];\r
    for (const a of acc) {\r
      if (p.n >= a.promised) { a.promised = p.n; a.acceptedN = p.n; a.acceptedV = value; accepters.push(a.id); }\r
    }\r
    const accepted = accepters.length >= majority;\r
    if (accepted) chosen = value;\r
    steps.push({\r
      proposer: p.proposer, n: p.n, phase: 'accepted', value, responders: accepters,\r
      text: accepted ? \`\${accepters.length}/\${acceptorCount} accept — value "\${value}" is CHOSEN\` : \`only \${accepters.length}/\${acceptorCount} accept — not chosen yet\`,\r
      acceptors: snap(), chosen,\r
    });\r
    if (accepted) steps.push({ proposer: p.proposer, n: p.n, phase: 'decision', value, text: \`Consensus: "\${value}" is decided and can never change\`, acceptors: snap(), chosen });\r
  }\r
\r
  return { steps, chosen };\r
}\r
`;export{e as default};