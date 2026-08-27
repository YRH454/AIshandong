var e=`// Stream watermarks — how a streaming engine (Flink, Beam, Kafka Streams) makes sense of events that\r
// arrive OUT OF ORDER and LATE. Every event carries an event-time (when it happened), but the network\r
// delivers them whenever. A WATERMARK is the engine's promise: "I've now seen everything up to time W."\r
// It's computed as (max event-time seen − allowed lateness): the lateness slack lets stragglers catch up.\r
// A time WINDOW (say [0,10)) fires its aggregate the moment the watermark passes its end — late enough to\r
// have collected the stragglers, but not waiting forever. An event that shows up after its window already\r
// fired is LATE and is dropped (or routed to a side output). This is the event-time-vs-processing-time\r
// distinction that makes streaming correct under real-world disorder. Reference: Akidau et al., "The\r
// Dataflow Model" (VLDB 2015); Apache Flink event-time docs.\r
\r
export interface Ev { id: string; time: number }            // event-time, delivered in array (arrival) order\r
export interface Win { start: number; end: number; events: string[]; firedAt: number } // firedAt = watermark when it fired (Infinity = flushed at stream end)\r
export interface Step { id: string; time: number; watermark: number; windowStart: number; late: boolean; fired: number[] }\r
export interface Result { steps: Step[]; windows: Win[]; late: string[] }\r
\r
const floorTo = (t: number, size: number) => Math.floor(t / size) * size;\r
\r
/** Process \`events\` (in arrival order) into tumbling windows of \`windowSize\`, with \`allowedLateness\` slack\r
 *  on the watermark. Returns the per-arrival trace, the fired windows, and the events dropped as too-late. */\r
export function processStream(events: Ev[], windowSize: number, allowedLateness: number): Result {\r
  const pending = new Map<number, string[]>(); // windowStart -> on-time event ids, not yet fired\r
  const fired = new Set<number>();\r
  const windows: Win[] = [];\r
  const late: string[] = [];\r
  const steps: Step[] = [];\r
  let maxTime = -Infinity;\r
\r
  const fireReady = (wm: number, firedNow: number[]) => {\r
    // fire every pending window whose end has been passed by the watermark, oldest first\r
    for (const ws of [...pending.keys()].sort((a, b) => a - b)) {\r
      if (ws + windowSize <= wm && !fired.has(ws)) {\r
        windows.push({ start: ws, end: ws + windowSize, events: pending.get(ws)!, firedAt: wm });\r
        fired.add(ws); pending.delete(ws); firedNow.push(ws);\r
      }\r
    }\r
  };\r
\r
  for (const e of events) {\r
    const ws = floorTo(e.time, windowSize);\r
    const curWm = maxTime === -Infinity ? -Infinity : maxTime - allowedLateness; // watermark before this event\r
    // Late if the watermark has already passed this window's end — whether the window fired or was never\r
    // even created (an empty window that conceptually elapsed). The watermark is the single source of truth.\r
    const isLate = ws + windowSize <= curWm;\r
    const firedNow: number[] = [];\r
    if (isLate) {\r
      late.push(e.id);\r
    } else {\r
      if (!pending.has(ws)) pending.set(ws, []);\r
      pending.get(ws)!.push(e.id);\r
      maxTime = Math.max(maxTime, e.time);\r
      fireReady(maxTime - allowedLateness, firedNow);\r
    }\r
    steps.push({ id: e.id, time: e.time, watermark: maxTime === -Infinity ? -Infinity : maxTime - allowedLateness, windowStart: ws, late: isLate, fired: firedNow });\r
  }\r
\r
  // End of stream: flush every remaining window (the watermark advances to +infinity).\r
  for (const ws of [...pending.keys()].sort((a, b) => a - b)) {\r
    windows.push({ start: ws, end: ws + windowSize, events: pending.get(ws)!, firedAt: Infinity });\r
    fired.add(ws);\r
  }\r
  return { steps, windows, late };\r
}\r
`;export{e as default};