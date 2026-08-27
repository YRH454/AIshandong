var e=`// Multipath TCP (MPTCP) — one TCP connection that runs over SEVERAL network paths at once (your phone's Wi-Fi\r
// AND cellular together), transparently to the app. A normal socket is pinned to one pair of IP addresses; if\r
// the Wi-Fi drops as you walk out the door, the connection dies. MPTCP splits the connection into SUBFLOWS,\r
// one per path, and stripes the byte stream across them. The trick that makes it safe is a second layer of\r
// sequence numbers: each subflow has its own ordinary TCP sequence space (so middleboxes see normal TCP), but\r
// every byte also carries a connection-level Data Sequence Number (DSN) via the DSS option. Segments race\r
// across paths and arrive out of order, but the receiver reassembles by DSN into the exact original stream. If\r
// a path fails, its unacknowledged bytes are simply re-sent on a surviving path — no data lost, the connection\r
// lives. It's how an iPhone keeps Siri and Apple Music alive across a Wi-Fi→cellular handoff, and how you can\r
// aggregate two links' bandwidth. This models the scheduling, out-of-order arrival, DSN reassembly, and\r
// failover. Reference: RFC 8684 (MPTCP v1); Apple's MPTCP deployment.\r
\r
export interface Path { id: number; name: string; capacity: number; latencyMs: number; up: boolean }\r
export interface Segment { dsn: number; chunk: string; pathId: number; arrival: number }\r
\r
/** Stripe chunks across the UP paths, weighted by capacity; compute each segment's arrival time\r
 *  (path latency + queueing at that path's send rate) so faster/lower-latency paths deliver sooner. */\r
export function schedule(chunks: string[], paths: Path[]): Segment[] {\r
  const up = paths.filter((p) => p.up);\r
  if (up.length === 0) return [];\r
  const sent = new Map<number, number>(up.map((p) => [p.id, 0]));\r
  const segs: Segment[] = [];\r
  for (let dsn = 0; dsn < chunks.length; dsn++) {\r
    // pick the up-path that is least loaded relative to its capacity (proportional-fair scheduling)\r
    let best = up[0];\r
    for (const p of up) if (sent.get(p.id)! / p.capacity < sent.get(best.id)! / best.capacity) best = p;\r
    const k = sent.get(best.id)!; sent.set(best.id, k + 1);\r
    segs.push({ dsn, chunk: chunks[dsn], pathId: best.id, arrival: best.latencyMs + (k / best.capacity) * 1000 });\r
  }\r
  return segs;\r
}\r
\r
/** Reassemble by connection-level Data Sequence Number — recovers the exact original stream, any arrival order. */\r
export function reassemble(segments: Segment[]): string {\r
  return [...segments].sort((a, b) => a.dsn - b.dsn).map((s) => s.chunk).join('');\r
}\r
\r
/** Segments in the order they actually arrive on the wire (by time, ties broken by dsn). */\r
export function arrivalOrder(segments: Segment[]): Segment[] {\r
  return [...segments].sort((a, b) => a.arrival - b.arrival || a.dsn - b.dsn);\r
}\r
\r
/** Aggregate throughput = sum of the up paths' capacities (the bandwidth win). */\r
export const throughput = (paths: Path[]): number => paths.filter((p) => p.up).reduce((s, p) => s + p.capacity, 0);\r
`;export{e as default};