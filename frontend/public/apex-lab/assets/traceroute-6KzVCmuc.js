var e=`// Traceroute — how a tool maps the routers between you and a destination using\r
// nothing but the TTL field. Every router decrements TTL by 1; when it hits 0 the\r
// router DROPS the packet and sends back an ICMP "Time Exceeded", revealing its own\r
// address. So you send probes with TTL = 1, 2, 3, …: each elicits a reply from the\r
// router one hop further out, until a probe finally reaches the destination, which\r
// replies differently (Echo Reply / Port Unreachable). A silent router shows "*".\r
// Pure, deterministic model. Tested.\r
\r
export interface Hop {\r
  address: string; // router/destination IP (or hostname-ish label)\r
  rttMs: number; // measured round-trip time to this hop\r
  responds: boolean; // some routers/firewalls don't send Time Exceeded → "* * *"\r
}\r
\r
export interface Path {\r
  source: string;\r
  dest: string;\r
  hops: Hop[]; // ordered routers between source and dest; the LAST hop is the destination\r
}\r
\r
export type ProbeKind = 'time-exceeded' | 'destination' | 'timeout';\r
\r
export interface ProbeResult {\r
  ttl: number;\r
  hopIndex: number; // which hop the probe reached (0-based; = ttl-1 when the path is long enough)\r
  kind: ProbeKind;\r
  address: string | null; // null when it timed out (no reply)\r
  rttMs: number | null;\r
  reachedDest: boolean;\r
}\r
\r
/**\r
 * Send one probe with the given TTL down the path. The router at index ttl-1 is the\r
 * one whose TTL reaches 0. If that hop IS the destination, it replies as the target;\r
 * if it doesn't respond, it's a timeout ("*"); otherwise it's an ICMP Time Exceeded.\r
 */\r
export function probe(path: Path, ttl: number): ProbeResult {\r
  const hopIndex = ttl - 1;\r
  const lastIndex = path.hops.length - 1;\r
  if (hopIndex > lastIndex) {\r
    // TTL is larger than the path — the destination already answered earlier; treat as done.\r
    const dest = path.hops[lastIndex];\r
    return { ttl, hopIndex: lastIndex, kind: 'destination', address: dest.address, rttMs: dest.rttMs, reachedDest: true };\r
  }\r
  const hop = path.hops[hopIndex];\r
  if (!hop.responds) return { ttl, hopIndex, kind: 'timeout', address: null, rttMs: null, reachedDest: hopIndex === lastIndex };\r
  const reachedDest = hopIndex === lastIndex;\r
  return {\r
    ttl, hopIndex,\r
    kind: reachedDest ? 'destination' : 'time-exceeded',\r
    address: hop.address,\r
    rttMs: hop.rttMs,\r
    reachedDest,\r
  };\r
}\r
\r
/** Run a full traceroute (TTL 1..maxTtl) and stop once the destination replies. */\r
export function traceroute(path: Path, maxTtl = 30): ProbeResult[] {\r
  const out: ProbeResult[] = [];\r
  for (let ttl = 1; ttl <= maxTtl; ttl++) {\r
    const r = probe(path, ttl);\r
    out.push(r);\r
    if (r.reachedDest) break;\r
  }\r
  return out;\r
}\r
`;export{e as default};