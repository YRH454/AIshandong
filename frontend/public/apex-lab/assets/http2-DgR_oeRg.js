var e=`// HTTP/2 multiplexing vs HTTP/1.1 head-of-line blocking. The single biggest win\r
// of HTTP/2 (RFC 7540) is that many requests share ONE TCP connection: each\r
// request is a STREAM, every stream's data is chopped into FRAMES, and frames\r
// from different streams INTERLEAVE on the wire. HTTP/1.1 on one connection must\r
// finish one response before the next can start — so a slow response blocks the\r
// quick ones behind it. We model both schedulers on an abstract time grid and\r
// compute per-stream completion times. Pure, tested.\r
\r
export interface Stream {\r
  id: number; // HTTP/2 stream id (odd = client-initiated)\r
  label: string;\r
  frames: number; // how many frame-sized chunks this response takes\r
}\r
\r
export interface Tick {\r
  t: number; // time slot index (one frame transmitted per slot)\r
  streamId: number; // which stream's frame occupies the shared connection this slot\r
}\r
\r
export interface Schedule {\r
  ticks: Tick[]; // the shared-connection timeline, one frame per slot\r
  finish: Record<number, number>; // streamId → slot at which its LAST frame is sent (1-based)\r
  totalSlots: number;\r
  lastFinish: number; // when the final stream completes\r
}\r
\r
/**\r
 * HTTP/1.1 over one connection: strictly serial. Stream A sends ALL its frames,\r
 * then stream B, etc. A long response head-of-line-blocks everything behind it.\r
 */\r
export function scheduleHttp11(streams: Stream[]): Schedule {\r
  const ticks: Tick[] = [];\r
  const finish: Record<number, number> = {};\r
  let t = 0;\r
  for (const s of streams) {\r
    for (let f = 0; f < s.frames; f++) ticks.push({ t: t++, streamId: s.id });\r
    finish[s.id] = t; // 1-based slot count when this stream's last frame went out\r
  }\r
  return { ticks, finish, totalSlots: t, lastFinish: t };\r
}\r
\r
/**\r
 * HTTP/2: round-robin interleave one frame per active stream per slot, so every\r
 * stream makes progress concurrently. Short responses finish early instead of\r
 * waiting behind long ones. (Real HTTP/2 honours priority/weights; round-robin is\r
 * the fair-share baseline that shows the multiplexing win.)\r
 */\r
export function scheduleHttp2(streams: Stream[]): Schedule {\r
  const remaining = streams.map((s) => ({ id: s.id, left: s.frames }));\r
  const ticks: Tick[] = [];\r
  const finish: Record<number, number> = {};\r
  let t = 0;\r
  while (remaining.some((r) => r.left > 0)) {\r
    for (const r of remaining) {\r
      if (r.left <= 0) continue;\r
      ticks.push({ t: t++, streamId: r.id });\r
      r.left--;\r
      if (r.left === 0) finish[r.id] = t;\r
    }\r
  }\r
  return { ticks, finish, totalSlots: t, lastFinish: t };\r
}\r
\r
/** Average completion time across streams (lower = snappier perceived load). */\r
export function avgFinish(sched: Schedule, streams: Stream[]): number {\r
  const sum = streams.reduce((a, s) => a + sched.finish[s.id], 0);\r
  return sum / streams.length;\r
}\r
`;export{e as default};