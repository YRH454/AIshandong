var e=`// Request coalescing (singleflight) — stopping a cache miss from turning into a stampede. When a hot\r
// cache key expires, every concurrent request misses at once and they ALL hit the backend for the same\r
// value: the "thundering herd" / cache stampede that can knock the database over precisely when traffic\r
// is highest. Singleflight fixes it: the first request for a key starts the computation, and every other\r
// request that arrives WHILE it's in flight waits for and shares that one result instead of starting its\r
// own. So N simultaneous misses become 1 backend call. Requests arriving after it completes just hit the\r
// now-warm cache. Reference: Go's golang.org/x/sync/singleflight; the cache-stampede literature.\r
\r
export interface Req { key: string; arrival: number }\r
export type Outcome = 'compute' | 'shared' | 'hit';\r
export interface FlightResult { results: { req: Req; outcome: Outcome }[]; computations: number; shared: number; hits: number }\r
\r
/** Process requests in arrival order. A key's first miss starts a computation lasting \`computeMs\`;\r
 *  requests for that key during the in-flight window either share it (singleflight) or each recompute\r
 *  (naive); once it completes the value is cached, so later requests are hits. */\r
export function simulate(reqs: Req[], computeMs: number, dedup: boolean): FlightResult {\r
  const sorted = [...reqs].sort((a, b) => a.arrival - b.arrival);\r
  const inflightUntil: Record<string, number> = {}; // key → end time of the active computation\r
  const warm: Record<string, boolean> = {};\r
  const results: { req: Req; outcome: Outcome }[] = [];\r
  let computations = 0, shared = 0, hits = 0;\r
\r
  for (const req of sorted) {\r
    const flying = inflightUntil[req.key] !== undefined && req.arrival < inflightUntil[req.key];\r
    let outcome: Outcome;\r
    if (flying) {\r
      if (dedup) { outcome = 'shared'; shared++; }            // coalesced into the in-flight call\r
      else { outcome = 'compute'; computations++; }            // naive: every concurrent miss recomputes\r
    } else if (warm[req.key]) {\r
      outcome = 'hit'; hits++;                                 // cache already populated\r
    } else {\r
      outcome = 'compute'; computations++;                     // the first miss starts the computation\r
      inflightUntil[req.key] = req.arrival + computeMs;\r
      warm[req.key] = true;                                    // value is cached once the computation finishes\r
    }\r
    results.push({ req, outcome });\r
  }\r
  return { results, computations, shared, hits };\r
}\r
`;export{e as default};