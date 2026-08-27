var e=`// Lamport logical clocks (Leslie Lamport, "Time, Clocks, and the Ordering of Events in\r
// a Distributed System", CACM 1978). With no shared physical clock, each process keeps\r
// a counter and follows three rules:\r
//   • before any event, increment your own counter;\r
//   • a message carries its sender's counter value;\r
//   • on receive, set counter = max(local, received) + 1.\r
// This guarantees the clock condition: if a happens-before b, then C(a) < C(b). The\r
// converse is NOT true — equal or ordered timestamps can belong to concurrent events —\r
// which is exactly the gap vector clocks close. A (timestamp, processId) pair gives a\r
// consistent TOTAL order. Pure and tested against a hand-worked space-time diagram.\r
\r
export type Kind = 'local' | 'send' | 'recv';\r
export interface InputEvent { proc: number; kind: Kind; msg?: string; label?: string }\r
export interface StampedEvent extends InputEvent { idx: number; ts: number }\r
\r
/** Assign Lamport timestamps by replaying the events in the given (causal) order. */\r
export function lamport(events: InputEvent[]): StampedEvent[] {\r
  const clocks: Record<number, number> = {};\r
  const msgTs: Record<string, number> = {};\r
  return events.map((e, idx) => {\r
    const c = clocks[e.proc] ?? 0;\r
    let ts: number;\r
    if (e.kind === 'recv') {\r
      const recvd = e.msg != null ? msgTs[e.msg] ?? 0 : 0;\r
      ts = Math.max(c, recvd) + 1;\r
    } else {\r
      ts = c + 1;\r
      if (e.kind === 'send' && e.msg != null) msgTs[e.msg] = ts;\r
    }\r
    clocks[e.proc] = ts;\r
    return { ...e, idx, ts };\r
  });\r
}\r
\r
/** Lamport's consistent total order: by timestamp, ties broken by process id. */\r
export function totalOrder(stamped: StampedEvent[]): StampedEvent[] {\r
  return [...stamped].sort((a, b) => a.ts - b.ts || a.proc - b.proc);\r
}\r
\r
/** Pair each send with its receive (matching msg), for drawing message arrows. */\r
export function messageArrows(stamped: StampedEvent[]): { from: StampedEvent; to: StampedEvent }[] {\r
  const sends = new Map<string, StampedEvent>();\r
  const arrows: { from: StampedEvent; to: StampedEvent }[] = [];\r
  for (const e of stamped) {\r
    if (e.kind === 'send' && e.msg != null) sends.set(e.msg, e);\r
    else if (e.kind === 'recv' && e.msg != null && sends.has(e.msg)) arrows.push({ from: sends.get(e.msg)!, to: e });\r
  }\r
  return arrows;\r
}\r
`;export{e as default};