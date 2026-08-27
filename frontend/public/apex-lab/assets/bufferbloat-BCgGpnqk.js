var e=`// Bufferbloat — why a too-large buffer wrecks latency. A bottleneck link drains a\r
// fixed number of packets per tick; when arrivals exceed that, the excess queues.\r
// With a BIG dumb buffer the queue grows huge before it ever drops, so every packet\r
// waits behind a long line — queuing delay balloons (your video call stutters while\r
// someone uploads). Active Queue Management (AQM, e.g. CoDel) drops/marks early when\r
// the *standing* queue delay exceeds a small target, keeping latency low at a slight\r
// throughput cost. Pure, deterministic model. Tested.\r
\r
export type Mode = 'big-buffer' | 'aqm';\r
\r
export interface QueueTick {\r
  t: number;\r
  arrived: number; // packets offered this tick\r
  queueBefore: number;\r
  dropped: number; // packets dropped this tick (overflow or AQM)\r
  drained: number; // packets that left (≤ capacity)\r
  queueAfter: number;\r
  delay: number; // queuing delay in ticks = queueAfter / drain\r
}\r
\r
export interface QueueConfig {\r
  ticks: number;\r
  drain: number; // link capacity: packets served per tick\r
  bufferSize: number; // max packets the buffer can hold\r
  arrivals: number[] | number; // per-tick arrivals (array) or a constant\r
  mode: Mode;\r
  aqmTargetDelay?: number; // AQM target standing delay in ticks (default 1)\r
}\r
\r
/**\r
 * Simulate the bottleneck queue. AQM (CoDel-style) tolerates a single-tick burst\r
 * above the target, but once the queue has STOOD above the target it drops the\r
 * excess to hold the standing queue near \`target\` — so latency stays low while the\r
 * big-buffer case lets the queue (and delay) grow until the buffer is full.\r
 */\r
export function simulateQueue(cfg: QueueConfig): QueueTick[] {\r
  const target = cfg.aqmTargetDelay ?? 1;\r
  const targetQueue = Math.max(1, Math.round(target * cfg.drain)); // standing queue AQM tolerates\r
  const arrivalsAt = (t: number) => (Array.isArray(cfg.arrivals) ? cfg.arrivals[t] ?? 0 : cfg.arrivals);\r
  const out: QueueTick[] = [];\r
  let queue = 0;\r
  let stoodAbove = false; // was the queue above target on the previous tick? (CoDel interval)\r
\r
  for (let t = 0; t < cfg.ticks; t++) {\r
    const arrived = arrivalsAt(t);\r
    const queueBefore = queue;\r
    let dropped = 0;\r
\r
    queue += arrived; // admit arrivals (a transient burst is allowed to queue)\r
\r
    if (cfg.mode === 'aqm') {\r
      // only drop once the queue has PERSISTED above target (not on the first burst)\r
      if (queue > targetQueue && stoodAbove) { dropped += queue - targetQueue; queue = targetQueue; }\r
      stoodAbove = queue > targetQueue;\r
    }\r
\r
    // physical buffer limit (tail drop) applies in both modes\r
    if (queue > cfg.bufferSize) { dropped += queue - cfg.bufferSize; queue = cfg.bufferSize; }\r
\r
    const drained = Math.min(cfg.drain, queue);\r
    queue -= drained;\r
\r
    out.push({ t, arrived, queueBefore, dropped, drained, queueAfter: queue, delay: queue / cfg.drain });\r
  }\r
  return out;\r
}\r
\r
/** Total packets dropped across a trace (AQM trades drops for low latency). */\r
export function totalDropped(trace: QueueTick[]): number {\r
  return trace.reduce((s, x) => s + x.dropped, 0);\r
}\r
\r
/** Peak and average queuing delay across a trace (in ticks). */\r
export function delayStats(trace: QueueTick[]): { peak: number; avg: number } {\r
  const peak = trace.reduce((m, x) => Math.max(m, x.delay), 0);\r
  const avg = trace.reduce((s, x) => s + x.delay, 0) / Math.max(1, trace.length);\r
  return { peak, avg };\r
}\r
`;export{e as default};