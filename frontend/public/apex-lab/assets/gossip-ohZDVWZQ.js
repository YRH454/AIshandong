var e=`// Gossip / epidemic dissemination — how a cluster spreads state (membership,\r
// config, a new value) without a central coordinator. Start with one node knowing\r
// the news; each round every informed node tells \`fanout\` random peers. The count\r
// informed follows an S-curve: a slow start, then near-exponential growth, then\r
// saturation as the last few uninformed nodes get harder to reach. It converges in\r
// about log_fanout(N) rounds — fast and resilient (no single point of failure).\r
// Deterministic via a seeded PRNG so the spread is reproducible and testable.\r
\r
/** Mulberry32 — a tiny, fast, deterministic PRNG (so runs are reproducible). */\r
export function rng(seed: number): () => number {\r
  let a = seed >>> 0;\r
  return () => {\r
    a |= 0; a = (a + 0x6d2b79f5) | 0;\r
    let t = Math.imul(a ^ (a >>> 15), 1 | a);\r
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;\r
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;\r
  };\r
}\r
\r
export interface GossipRound {\r
  round: number;\r
  informed: boolean[]; // snapshot of who knows after this round\r
  count: number; // how many are informed\r
  newlyInformed: number[]; // node indices informed THIS round\r
  contacts: [number, number][]; // [from, to] pairs attempted this round (for the viz)\r
}\r
\r
export interface GossipResult {\r
  n: number;\r
  fanout: number;\r
  rounds: GossipRound[]; // rounds[0] = the seed state\r
  roundsToFull: number; // first round where everyone is informed (or -1 if not)\r
}\r
\r
/** Run push-gossip from node 0 with the given fanout until everyone knows (or maxRounds). */\r
export function gossip(n: number, fanout: number, seed = 1, maxRounds = 40): GossipResult {\r
  const rand = rng(seed);\r
  const informed = new Array<boolean>(n).fill(false);\r
  informed[0] = true;\r
  const rounds: GossipRound[] = [{ round: 0, informed: informed.slice(), count: 1, newlyInformed: [0], contacts: [] }];\r
  let roundsToFull = n === 1 ? 0 : -1;\r
\r
  for (let r = 1; r <= maxRounds && roundsToFull < 0; r++) {\r
    const senders: number[] = [];\r
    for (let i = 0; i < n; i++) if (informed[i]) senders.push(i);\r
    const newly: number[] = [];\r
    const contacts: [number, number][] = [];\r
\r
    for (const s of senders) {\r
      for (let f = 0; f < fanout; f++) {\r
        const target = Math.floor(rand() * n);\r
        if (target === s) continue; // don't gossip to yourself\r
        contacts.push([s, target]);\r
        if (!informed[target]) { informed[target] = true; newly.push(target); }\r
      }\r
    }\r
    const count = informed.filter(Boolean).length;\r
    rounds.push({ round: r, informed: informed.slice(), count, newlyInformed: newly, contacts });\r
    if (count === n) roundsToFull = r;\r
  }\r
  return { n, fanout, rounds, roundsToFull };\r
}\r
`;export{e as default};