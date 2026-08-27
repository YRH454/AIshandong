var e=`// The Bully algorithm for leader election (Garcia-Molina, 1982). When the coordinator\r
// dies, the live node with the HIGHEST id should take over. A node that notices the gap\r
// starts an election: it sends ELECTION to every higher-id node. Any live higher node\r
// answers OK ("I'll take it from here") and starts its own election upward. Whoever gets\r
// no OK back is the highest alive — it declares itself by broadcasting COORDINATOR. So the\r
// winner is always max(alive), no matter who starts. Pure model; the outcome and the\r
// message flow are tested.\r
\r
export type MsgType = 'ELECTION' | 'OK' | 'COORDINATOR';\r
export interface Message { round: number; type: MsgType; from: number; to: number }\r
\r
export interface Election { messages: Message[]; coordinator: number }\r
\r
/** Run a Bully election. \`nodes\` are all node ids; \`alive\` is the set still up; \`starter\`\r
 *  is the node that first notices the coordinator is gone and kicks it off. */\r
export function runElection(nodes: number[], alive: Set<number>, starter: number): Election {\r
  const sorted = [...nodes].sort((a, b) => a - b);\r
  const coordinator = Math.max(...sorted.filter((n) => alive.has(n)));\r
  const messages: Message[] = [];\r
\r
  // every live node from the starter up runs its own election (it received an ELECTION\r
  // and answers by starting one toward still-higher nodes)\r
  const runners = sorted.filter((n) => n === starter || (n > starter && alive.has(n)));\r
\r
  runners.forEach((r, i) => {\r
    const higher = sorted.filter((n) => n > r);\r
    for (const h of higher) {\r
      messages.push({ round: i, type: 'ELECTION', from: r, to: h });\r
      if (alive.has(h)) messages.push({ round: i, type: 'OK', from: h, to: r });\r
    }\r
  });\r
\r
  // the highest alive node got no OK → it announces itself to everyone else\r
  const announceRound = runners.length;\r
  for (const n of sorted) if (n !== coordinator) messages.push({ round: announceRound, type: 'COORDINATOR', from: coordinator, to: n });\r
\r
  return { messages, coordinator };\r
}\r
`;export{e as default};