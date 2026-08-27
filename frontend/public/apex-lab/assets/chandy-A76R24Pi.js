var e=`// Chandy-Lamport global snapshot (Chandy & Lamport, 1985: "Distributed Snapshots: Determining\r
// Global States of Distributed Systems"). How do you photograph the global state of a distributed\r
// system with no shared clock, without freezing everything? You can't read every process and every\r
// in-flight message at one instant. Chandy-Lamport gets a *consistent* state — one that could have\r
// occurred — using marker messages over FIFO channels:\r
//   • An initiator records its own state, then sends a MARKER on every outgoing channel.\r
//   • When a process first sees a MARKER (on channel c): it records its own state, records c's\r
//     channel state as EMPTY, sends MARKERs on all its outgoing channels, and starts recording\r
//     every OTHER incoming channel.\r
//   • When an already-recorded process sees a MARKER on c: it stops recording c — c's recorded\r
//     state is exactly the messages that arrived on c after this process recorded itself.\r
// We use the classic distributed-bank framing (money moving between accounts over channels) because\r
// it makes the guarantee checkable: the recorded snapshot — process balances PLUS the money caught\r
// in-flight in the channels — must conserve the total. A naive read of just the balances would lose\r
// the in-flight money. Honest event-driven model over FIFO channels, tested against that invariant.\r
\r
export type ChItem = { kind: 'money'; amount: number } | { kind: 'marker' };\r
\r
export type SnapEvent =\r
  | { type: 'send'; from: string; to: string; amount: number } // \`from\` sends money into channel from→to\r
  | { type: 'recv'; from: string; to: string } //                 \`to\` consumes the head of channel from→to\r
  | { type: 'init'; p: string }; //                               process p initiates the snapshot\r
\r
export interface Scenario {\r
  processes: { id: string; balance: number }[];\r
  channels: [string, string][]; // directed FIFO channels [from, to]\r
  events: SnapEvent[];\r
}\r
\r
export interface Step {\r
  n: number;\r
  tag: 'send' | 'recv-money' | 'recv-marker' | 'init';\r
  desc: string;\r
  balances: Record<string, number>; // live balances after this step\r
  queues: Record<string, ChItem[]>; // live channel contents (in-flight) after this step\r
  recorded: Record<string, boolean>; // which processes have recorded their state\r
  recordedBalance: Record<string, number | null>;\r
  chMsgs: Record<string, number[]>; // money recorded as channel state so far\r
}\r
\r
export interface SnapResult {\r
  steps: Step[];\r
  complete: boolean; // every process recorded and every channel's marker consumed\r
  recordedBalance: Record<string, number>;\r
  chMsgs: Record<string, number[]>; // final recorded channel state (in-flight money) per channel\r
  snapshotTotal: number; // recorded balances + recorded channel money\r
  naiveTotal: number; // recorded balances only (what you'd get if you ignored channel state)\r
  initialTotal: number;\r
  conserved: boolean; // snapshotTotal === initialTotal  ← the Chandy-Lamport guarantee\r
}\r
\r
const key = (from: string, to: string) => \`\${from}->\${to}\`;\r
\r
export function run(s: Scenario): SnapResult {\r
  const balance: Record<string, number> = {};\r
  s.processes.forEach((p) => (balance[p.id] = p.balance));\r
  const initialTotal = s.processes.reduce((a, p) => a + p.balance, 0);\r
\r
  const queue: Record<string, ChItem[]> = {};\r
  const chMsgs: Record<string, number[]> = {};\r
  const recording: Record<string, boolean> = {};\r
  const markerSeen: Record<string, boolean> = {};\r
  s.channels.forEach(([f, t]) => {\r
    queue[key(f, t)] = [];\r
    chMsgs[key(f, t)] = [];\r
    recording[key(f, t)] = false;\r
    markerSeen[key(f, t)] = false;\r
  });\r
\r
  const recorded: Record<string, boolean> = {};\r
  const recordedBalance: Record<string, number | null> = {};\r
  s.processes.forEach((p) => { recorded[p.id] = false; recordedBalance[p.id] = null; });\r
\r
  const outgoing = (p: string) => s.channels.filter(([f]) => f === p);\r
  const incoming = (p: string) => s.channels.filter(([, t]) => t === p);\r
\r
  const recordState = (p: string) => { recorded[p] = true; recordedBalance[p] = balance[p]; };\r
  const sendMarkers = (p: string) => outgoing(p).forEach(([f, t]) => queue[key(f, t)].push({ kind: 'marker' }));\r
\r
  const steps: Step[] = [];\r
  const snap = (tag: Step['tag'], desc: string) => {\r
    steps.push({\r
      n: steps.length + 1, tag, desc,\r
      balances: { ...balance },\r
      queues: Object.fromEntries(Object.entries(queue).map(([k, v]) => [k, v.map((i) => ({ ...i }))])),\r
      recorded: { ...recorded },\r
      recordedBalance: { ...recordedBalance },\r
      chMsgs: Object.fromEntries(Object.entries(chMsgs).map(([k, v]) => [k, [...v]])),\r
    });\r
  };\r
\r
  for (const e of s.events) {\r
    if (e.type === 'send') {\r
      balance[e.from] -= e.amount;\r
      queue[key(e.from, e.to)].push({ kind: 'money', amount: e.amount });\r
      snap('send', \`\${e.from} sends $\${e.amount} → \${e.to} (now in flight on \${key(e.from, e.to)})\`);\r
    } else if (e.type === 'init') {\r
      recordState(e.p);\r
      incoming(e.p).forEach(([f, t]) => (recording[key(f, t)] = true)); // record all inbound channels\r
      sendMarkers(e.p);\r
      snap('init', \`\${e.p} INITIATES: records its state ($\${balance[e.p]}) and sends a marker on every outgoing channel\`);\r
    } else {\r
      const k = key(e.from, e.to);\r
      const item = queue[k].shift();\r
      if (!item) { snap('recv-money', \`\${e.to} tried to read \${k} but it was empty\`); continue; }\r
      if (item.kind === 'money') {\r
        balance[e.to] += item.amount;\r
        const captured = recorded[e.to] && recording[k];\r
        if (captured) chMsgs[k].push(item.amount);\r
        snap('recv-money', \`\${e.to} receives $\${item.amount} on \${k}\${captured ? \` — CAPTURED as channel state (it was in flight across the cut)\` : ''}\`);\r
      } else {\r
        if (!recorded[e.to]) {\r
          recordState(e.to);\r
          markerSeen[k] = true; recording[k] = false; // first marker ⇒ this channel records empty\r
          incoming(e.to).forEach(([f, t]) => { if (key(f, t) !== k) recording[key(f, t)] = true; });\r
          sendMarkers(e.to);\r
          snap('recv-marker', \`\${e.to} sees its FIRST marker (on \${k}): records its state ($\${balance[e.to]}), marks \${k} empty, forwards markers, starts recording its other inbound channels\`);\r
        } else {\r
          markerSeen[k] = true; recording[k] = false; // finalize this channel's recorded state\r
          snap('recv-marker', \`\${e.to} sees a marker on \${k}: stops recording it — channel state = {\${chMsgs[k].map((m) => '$' + m).join(', ')}}\`);\r
        }\r
      }\r
    }\r
  }\r
\r
  const complete = s.processes.every((p) => recorded[p.id]) && s.channels.every(([f, t]) => markerSeen[key(f, t)]);\r
  const recBal: Record<string, number> = {};\r
  s.processes.forEach((p) => (recBal[p.id] = recordedBalance[p.id] ?? balance[p.id]));\r
  const naiveTotal = Object.values(recBal).reduce((a, b) => a + b, 0);\r
  const channelMoney = Object.values(chMsgs).reduce((a, v) => a + v.reduce((x, y) => x + y, 0), 0);\r
  const snapshotTotal = naiveTotal + channelMoney;\r
\r
  return { steps, complete, recordedBalance: recBal, chMsgs, snapshotTotal, naiveTotal, initialTotal, conserved: snapshotTotal === initialTotal };\r
}\r
\r
/** The canonical two-account scenario: a $10 transfer is in flight across the cut and only the\r
 *  channel-state capture keeps the books balanced. */\r
export const CLASSIC: Scenario = {\r
  processes: [{ id: 'P0', balance: 100 }, { id: 'P1', balance: 50 }],\r
  channels: [['P0', 'P1'], ['P1', 'P0']],\r
  events: [\r
    { type: 'send', from: 'P0', to: 'P1', amount: 20 }, // $20 P0→P1 (will be received before the marker)\r
    { type: 'init', p: 'P0' }, //                          P0 starts the snapshot\r
    { type: 'recv', from: 'P0', to: 'P1' }, //             P1 gets the $20 (pre-marker ⇒ part of P1's state)\r
    { type: 'send', from: 'P1', to: 'P0', amount: 10 }, // $10 P1→P0 — this is the one caught in flight\r
    { type: 'recv', from: 'P0', to: 'P1' }, //             P1 gets the marker ⇒ records itself ($60)\r
    { type: 'recv', from: 'P1', to: 'P0' }, //             P0 gets the $10 ⇒ CAPTURED as channel state\r
    { type: 'recv', from: 'P1', to: 'P0' }, //             P0 gets the marker ⇒ snapshot complete\r
  ],\r
};\r
`;export{e as default};