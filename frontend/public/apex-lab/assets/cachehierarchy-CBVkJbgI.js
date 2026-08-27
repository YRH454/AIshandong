var e=`// CDN / cache hierarchy — why the web is fast. A request for an object cascades\r
// through tiers: browser cache → CDN edge → origin. Each tier serves a HIT if it\r
// holds a copy that is still fresh (stored + TTL not yet expired); otherwise it's a\r
// MISS and the request continues to the next tier, which fetches, stores a copy\r
// (with its own TTL), and answers. When a cached copy has expired the tier\r
// REVALIDATES with the origin — a cheap conditional request that usually returns\r
// "304 Not Modified" and just refreshes the TTL. Latency grows with each tier you\r
// fall through. Pure, deterministic model (HTTP caching, RFC 9111). Tested.\r
\r
export type Tier = 'browser' | 'edge' | 'origin';\r
export const TIERS: Tier[] = ['browser', 'edge', 'origin'];\r
export const LATENCY: Record<Tier, number> = { browser: 0, edge: 20, origin: 200 }; // ms to reach each tier\r
export const TTL: Record<Tier, number> = { browser: 30, edge: 120, origin: Infinity }; // freshness per tier (s)\r
\r
interface Entry { storedAt: number } // when this tier cached the object\r
\r
export interface RequestResult {\r
  object: string;\r
  servedBy: Tier; // which tier ultimately answered\r
  path: { tier: Tier; outcome: 'hit' | 'miss' | 'revalidated' }[]; // the cascade\r
  latencyMs: number;\r
  revalidated: boolean; // did any tier do a 304 refresh?\r
}\r
\r
export class CacheHierarchy {\r
  // per tier: object name → cache entry\r
  private caches: Record<Tier, Map<string, Entry>> = { browser: new Map(), edge: new Map(), origin: new Map() };\r
  private hits = 0;\r
  private total = 0;\r
\r
  constructor() {\r
    // the origin is authoritative — it always "has" everything (TTL ∞).\r
  }\r
\r
  get hitRatio(): number { return this.total ? this.hits / this.total : 0; }\r
  get requests(): number { return this.total; }\r
\r
  /** What each tier currently holds + seconds of TTL remaining (for display). */\r
  snapshot(now: number): Record<Tier, { object: string; ttlLeft: number }[]> {\r
    const out = { browser: [], edge: [], origin: [] } as Record<Tier, { object: string; ttlLeft: number }[]>;\r
    for (const tier of TIERS) {\r
      for (const [object, e] of this.caches[tier]) {\r
        const ttl = TTL[tier];\r
        out[tier].push({ object, ttlLeft: ttl === Infinity ? Infinity : Math.max(0, ttl - (now - e.storedAt)) });\r
      }\r
    }\r
    return out;\r
  }\r
\r
  private fresh(tier: Tier, object: string, now: number): boolean {\r
    const e = this.caches[tier].get(object);\r
    if (!e) return false;\r
    const ttl = TTL[tier];\r
    return ttl === Infinity || now - e.storedAt < ttl;\r
  }\r
\r
  /** Request \`object\` at time \`now\` (seconds). Walks the tiers, caching on the way back. */\r
  request(object: string, now: number): RequestResult {\r
    this.total++;\r
    const path: RequestResult['path'] = [];\r
    let hadStale = false; // did a cache hold an EXPIRED copy on the way down?\r
\r
    for (let i = 0; i < TIERS.length; i++) {\r
      const tier = TIERS[i];\r
      if (this.fresh(tier, object, now)) {\r
        // a fresh copy serves the request; reaching the origin with stale upstream\r
        // copies is a 304 revalidation (cheap refresh) rather than a clean hit.\r
        const reval = tier === 'origin' && hadStale;\r
        path.push({ tier, outcome: reval ? 'revalidated' : 'hit' });\r
        if (tier !== 'origin') this.hits++; // served from a real cache → saved a trip\r
        this.storeUpTo(i, object, now); // refresh this tier and the ones above it\r
        return { object, servedBy: tier, path, latencyMs: LATENCY[tier], revalidated: reval };\r
      }\r
      if (this.caches[tier].has(object)) hadStale = true; // an expired copy lived here\r
      path.push({ tier, outcome: 'miss' });\r
    }\r
\r
    // Fell through every tier → the origin had no copy at all (cold object): fetch + store.\r
    this.caches.origin.set(object, { storedAt: now });\r
    this.storeUpTo(TIERS.length - 1, object, now);\r
    return { object, servedBy: 'origin', path, latencyMs: LATENCY.origin, revalidated: false };\r
  }\r
\r
  /** Cache the object in every tier from \`topIndex\` up to the browser (index 0). */\r
  private storeUpTo(topIndex: number, object: string, now: number): void {\r
    for (let j = 0; j <= topIndex; j++) this.caches[TIERS[j]].set(object, { storedAt: now });\r
  }\r
}\r
`;export{e as default};