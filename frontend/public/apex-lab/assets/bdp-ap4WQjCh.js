var e=`// Bandwidth-Delay Product — why a fast link can still be slow. To keep a pipe full, a\r
// sender must have at least one round-trip's worth of data "in flight": that's the BDP =\r
// bandwidth × RTT. TCP can only have one window of unacknowledged data outstanding, so if\r
// the window is smaller than the BDP, throughput is capped at window / RTT — far below the\r
// link's capacity. This is why the original 64 KB window throttles transfers on\r
// high-bandwidth, high-latency ("long fat") links, and why Window Scaling (RFC 7323)\r
// exists. Pure arithmetic, tested against the textbook 1 Gbps / 100 ms case.\r
\r
export interface Bdp {\r
  bdpBytes: number;            // bandwidth × RTT, the bytes needed to fill the pipe\r
  windowBytes: number;\r
  linkBytesPerSec: number;\r
  windowLimitedMbps: number;   // throughput the window allows = window / RTT\r
  effectiveMbps: number;       // min(link bandwidth, window-limited)\r
  utilization: number;         // effective / bandwidth, in [0,1]\r
  windowNeededKB: number;      // window size that would fill the pipe\r
  windowLimited: boolean;      // is the window the bottleneck?\r
}\r
\r
/** @param bandwidthMbps link rate, @param rttMs round-trip time, @param windowKB TCP window. */\r
export function compute(bandwidthMbps: number, rttMs: number, windowKB: number): Bdp {\r
  const rttSec = rttMs / 1000;\r
  const linkBytesPerSec = (bandwidthMbps * 1e6) / 8;\r
  const bdpBytes = linkBytesPerSec * rttSec;\r
  const windowBytes = windowKB * 1024;\r
  const windowLimitedMbps = (windowBytes / rttSec) * 8 / 1e6;\r
  const effectiveMbps = Math.min(bandwidthMbps, windowLimitedMbps);\r
  return {\r
    bdpBytes,\r
    windowBytes,\r
    linkBytesPerSec,\r
    windowLimitedMbps,\r
    effectiveMbps,\r
    utilization: effectiveMbps / bandwidthMbps,\r
    windowNeededKB: bdpBytes / 1024,\r
    windowLimited: windowBytes < bdpBytes,\r
  };\r
}\r
\r
/** The classic windows: 64 KB is the un-scaled TCP maximum; scaling reaches into GBs. */\r
export const UNSCALED_MAX_KB = 64;\r
`;export{e as default};