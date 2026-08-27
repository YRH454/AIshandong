var e=`// Load balancing — how a front door spreads requests across backend servers. Six\r
// strategies, each with different behaviour under uneven load:\r
//   round-robin       — cycle through backends in order; even when requests differ\r
//   weighted RR       — bigger servers get proportionally more requests\r
//   least-connections — send to whoever has the fewest active requests (adapts)\r
//   ip-hash           — hash the client id → always the same backend (sticky sessions)\r
//   random            — pick a backend uniformly at random (cheap, but a bad tail)\r
//   power-of-two (p2c)— sample TWO random backends, send to the less-loaded one.\r
// P2C is the surprising one: adding a single extra random sample drops the busiest\r
// backend's load from O(log n / log log n) above average down to O(log log n) — an\r
// exponential improvement — with none of least-conn's need to scan every backend. It\r
// is the modern default (NGINX, HAProxy, Netflix, Envoy). A request occupies a backend\r
// for a duration; least-conn and p2c react to that, RR/random don't.\r
// Pure, deterministic model (seeded RNG). Tested.\r
\r
export type Algo = 'round-robin' | 'weighted' | 'least-conn' | 'ip-hash' | 'random' | 'p2c';\r
\r
export interface Backend {\r
  id: string;\r
  weight: number; // for weighted RR (and a tie-break hint)\r
  active: number; // current in-flight requests\r
  handled: number; // total requests dispatched here\r
}\r
\r
export interface Req { client: string; duration: number }\r
\r
export interface Assignment { req: Req; backend: string; at: number }\r
\r
function fnv(s: string): number {\r
  let h = 0x811c9dc5;\r
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }\r
  return h >>> 0;\r
}\r
\r
export class Balancer {\r
  readonly algo: Algo;\r
  readonly backends: Backend[];\r
  private rr = 0; // round-robin cursor\r
  private wrr = 0; // weighted expanded cursor\r
  private weightedSeq: number[]; // expanded index list for weighted RR\r
  private clock = 0;\r
  private seed: number; // seeded PRNG state for random / p2c (deterministic)\r
\r
  constructor(algo: Algo, backends: { id: string; weight?: number }[], seed = 1) {\r
    this.algo = algo;\r
    this.seed = seed >>> 0;\r
    this.backends = backends.map((b) => ({ id: b.id, weight: b.weight ?? 1, active: 0, handled: 0 }));\r
    this.weightedSeq = [];\r
    this.backends.forEach((b, i) => { for (let w = 0; w < b.weight; w++) this.weightedSeq.push(i); });\r
  }\r
\r
  // LCG in [0,1); divide by 2^31 (not the mask) so it never returns exactly 1.0 → floor stays in range.\r
  private rand(): number { this.seed = (Math.imul(this.seed, 1103515245) + 12345) & 0x7fffffff; return this.seed / 0x80000000; }\r
  private randIndex(n: number): number { return Math.floor(this.rand() * n); }\r
\r
  /** Free a backend slot when a request finishes (active--). */\r
  release(backendId: string): void {\r
    const b = this.backends.find((x) => x.id === backendId);\r
    if (b && b.active > 0) b.active--;\r
  }\r
\r
  /** Dispatch one request, returning which backend it landed on. */\r
  dispatch(req: Req): Assignment {\r
    this.clock++;\r
    const idx = this.pick(req);\r
    const b = this.backends[idx];\r
    b.active++; b.handled++;\r
    return { req, backend: b.id, at: this.clock };\r
  }\r
\r
  private pick(req: Req): number {\r
    switch (this.algo) {\r
      case 'round-robin': {\r
        const i = this.rr % this.backends.length; this.rr++; return i;\r
      }\r
      case 'weighted': {\r
        const i = this.weightedSeq[this.wrr % this.weightedSeq.length]; this.wrr++; return i;\r
      }\r
      case 'least-conn': {\r
        // fewest active; tie-break by higher weight, then by index for determinism\r
        let best = 0;\r
        for (let i = 1; i < this.backends.length; i++) {\r
          const a = this.backends[i], b = this.backends[best];\r
          if (a.active < b.active || (a.active === b.active && a.weight > b.weight)) best = i;\r
        }\r
        return best;\r
      }\r
      case 'ip-hash':\r
        return fnv(req.client) % this.backends.length;\r
      case 'random':\r
        return this.randIndex(this.backends.length);\r
      case 'p2c': {\r
        // sample two DISTINCT backends, send to the one with fewer active requests\r
        const n = this.backends.length;\r
        if (n === 1) return 0;\r
        const i = this.randIndex(n);\r
        let j = this.randIndex(n - 1); if (j >= i) j++; // distinct second sample\r
        const bi = this.backends[i], bj = this.backends[j];\r
        // fewer active wins; tie-break by higher weight, then lower index — deterministic\r
        if (bj.active < bi.active || (bj.active === bi.active && bj.weight > bi.weight)) return j;\r
        return i;\r
      }\r
    }\r
  }\r
\r
  /** A snapshot of handled counts keyed by backend id. */\r
  get handledMap(): Record<string, number> {\r
    return Object.fromEntries(this.backends.map((b) => [b.id, b.handled]));\r
  }\r
}\r
\r
/** Skew = max−min handled count (0 = perfectly even). */\r
export function skew(handled: Record<string, number>): number {\r
  const v = Object.values(handled);\r
  return v.length ? Math.max(...v) - Math.min(...v) : 0;\r
}\r
\r
/** The busiest backend's count — the tail metric P2C is designed to shrink. */\r
export function maxLoad(counts: Record<string, number>): number {\r
  const v = Object.values(counts);\r
  return v.length ? Math.max(...v) : 0;\r
}\r
`;export{e as default};