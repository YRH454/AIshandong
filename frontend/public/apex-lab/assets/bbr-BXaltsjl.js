var e=`// TCP BBR (Cardwell et al., 2016) — congestion control that models the path instead of\r
// reacting to loss. BBR continuously estimates two things: the bottleneck bandwidth\r
// (BtlBw, the max delivery rate it has seen) and the round-trip propagation delay (RTprop,\r
// the min RTT it has seen). Their product is the Bandwidth-Delay Product, and BBR keeps\r
// just about one BDP of data in flight — enough to fill the pipe, but not so much that data\r
// piles up in the bottleneck's buffer. That's the whole point: loss-based controllers\r
// (Reno/CUBIC) keep pushing until the buffer overflows, which adds latency (bufferbloat)\r
// for everyone; BBR holds the queue near empty. Pure model, tested.\r
\r
export interface Link { btlBwMbps: number; rtPropMs: number; bufferKB: number }\r
\r
/** BDP in kilobytes = bandwidth × propagation delay. */\r
export function bdpKB(link: Link): number {\r
  return (link.btlBwMbps * 1e6 / 8) * (link.rtPropMs / 1000) / 1024;\r
}\r
\r
export interface FlowState {\r
  inflightKB: number;\r
  queueKB: number;       // data sitting in the bottleneck buffer\r
  rttMs: number;         // experienced RTT = propagation + queueing\r
  throughputMbps: number;\r
}\r
\r
/** BBR steady state: hold inflight ≈ 1 BDP, so the buffer stays essentially empty. */\r
export function bbrSteady(link: Link): FlowState {\r
  const bdp = bdpKB(link);\r
  const inflight = bdp; // BBR targets one BDP\r
  const queue = Math.max(0, inflight - bdp); // ≈ 0\r
  return { inflightKB: inflight, queueKB: queue, rttMs: link.rtPropMs + (queue * 1024 * 8) / (link.btlBwMbps * 1e6) * 1000, throughputMbps: link.btlBwMbps };\r
}\r
\r
/** Loss-based steady state: grow until the buffer is full, so queue = buffer (bufferbloat). */\r
export function lossBasedSteady(link: Link): FlowState {\r
  const bdp = bdpKB(link);\r
  const inflight = bdp + link.bufferKB; // fills the pipe AND the buffer before loss\r
  const queue = link.bufferKB;\r
  const queueDelayMs = (queue * 1024 * 8) / (link.btlBwMbps * 1e6) * 1000;\r
  return { inflightKB: inflight, queueKB: queue, rttMs: link.rtPropMs + queueDelayMs, throughputMbps: link.btlBwMbps };\r
}\r
\r
export interface StartupRound { round: number; estBwMbps: number; plateau: boolean }\r
\r
/** BBR STARTUP: double the delivery-rate estimate each round until it stops growing —\r
 *  that plateau is BtlBw. (Three flat rounds → exit startup and drain the queue.) */\r
export function startup(link: Link, rounds = 10): StartupRound[] {\r
  const out: StartupRound[] = [];\r
  let est = 1; // Mbps, initial probe\r
  let flat = 0;\r
  for (let r = 0; r < rounds; r++) {\r
    const next = Math.min(est * 2, link.btlBwMbps); // can't deliver faster than the bottleneck\r
    const plateau = next === est;\r
    if (plateau) flat++; else flat = 0;\r
    out.push({ round: r, estBwMbps: next, plateau });\r
    est = next;\r
    if (flat >= 3) break; // BtlBw found — real BBR exits STARTUP after 3 rounds with no >25% growth\r
  }\r
  return out;\r
}\r
`;export{e as default};