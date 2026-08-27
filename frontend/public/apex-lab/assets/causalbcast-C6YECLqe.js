var e=`// Causal broadcast — delivering messages in an order that respects cause and effect, even when the\r
// network reorders them. If Alice posts "the build is broken" and Bob replies "on it", nobody should\r
// ever see Bob's reply before Alice's message. Vector clocks make this enforceable: every broadcast\r
// is tagged with the sender's vector clock, and a receiver DELIVERS a message only when it has already\r
// delivered everything that message causally depends on — otherwise it BUFFERS it and releases it\r
// later, once the gap is filled. The rule (Birman-Schiper-Stephenson): a message m from process j is\r
// deliverable at k iff m.vc[j] == k.vc[j]+1 (it's the next one from j) AND m.vc[l] <= k.vc[l] for every\r
// other l (k has seen everything m saw). Pure model of one receiver's delivery logic, tested.\r
\r
export interface BMsg { id: string; from: number; vc: number[] } // tagged with the sender's clock at send\r
\r
export interface CBEvent { msgId: string; action: 'delivered' | 'buffered' | 'released'; vc: number[] | null }\r
export interface CBRun { events: CBEvent[]; deliveryOrder: string[]; finalVc: number[] }\r
\r
/** Is message m deliverable to a receiver whose current vector clock is kvc? */\r
export function deliverable(kvc: number[], m: BMsg): boolean {\r
  if (m.vc[m.from] !== kvc[m.from] + 1) return false; // must be the very next message from its sender\r
  for (let l = 0; l < kvc.length; l++) if (l !== m.from && m.vc[l] > kvc[l]) return false; // and no missing dependency\r
  return true;\r
}\r
\r
/** Process arrivals (possibly reordered) at one receiver, buffering until each is causally deliverable. */\r
export function receive(numProcs: number, arrivals: BMsg[]): CBRun {\r
  const kvc = new Array(numProcs).fill(0);\r
  const buffer: BMsg[] = [];\r
  const events: CBEvent[] = [];\r
  const deliveryOrder: string[] = [];\r
\r
  const deliver = (m: BMsg) => {\r
    kvc[m.from] += 1; // record that we've now seen this message from its sender\r
    deliveryOrder.push(m.id);\r
    events.push({ msgId: m.id, action: 'delivered', vc: [...kvc] });\r
  };\r
  const drainBuffer = () => {\r
    let progress = true;\r
    while (progress) {\r
      progress = false;\r
      for (let i = 0; i < buffer.length; i++) {\r
        if (deliverable(kvc, buffer[i])) {\r
          const bm = buffer.splice(i, 1)[0];\r
          events.push({ msgId: bm.id, action: 'released', vc: null }); // a buffered message becomes deliverable\r
          deliver(bm);\r
          progress = true;\r
          break;\r
        }\r
      }\r
    }\r
  };\r
\r
  for (const m of arrivals) {\r
    if (deliverable(kvc, m)) { deliver(m); drainBuffer(); }\r
    else { buffer.push(m); events.push({ msgId: m.id, action: 'buffered', vc: null }); }\r
  }\r
  return { events, deliveryOrder, finalVc: kvc };\r
}\r
`;export{e as default};