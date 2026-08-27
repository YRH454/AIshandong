var e=`// The TLB (Translation Lookaside Buffer) — the tiny cache that makes virtual memory fast. Every memory\r
// access needs the virtual page number translated to a physical frame, and doing the full multi-level\r
// page-table walk each time would be ruinous (several extra memory reads per access). So the CPU caches\r
// recent translations in the TLB: a HIT resolves in ~1 cycle, a MISS pays for the walk (~tens to a\r
// hundred cycles) and then fills the TLB. Because programs have locality — loops touch the same few\r
// pages over and over — the hit rate is normally well above 99%, so the slow walk almost never happens.\r
// The catch is the WORKING SET: if the pages a loop touches outnumber the TLB's entries, every access\r
// evicts one it's about to need again (thrashing) and the hit rate collapses. Reference: Hennessy &\r
// Patterson; OSTEP ch.19 (TLBs). We model a fully-associative, LRU TLB.\r
\r
export interface TlbStep { vpn: number; hit: boolean; evicted: number | null; tlbAfter: number[] }\r
export interface TlbResult { steps: TlbStep[]; hits: number; misses: number; hitRate: number }\r
\r
export const HIT_CYCLES = 1;\r
export const MISS_CYCLES = 100; // a page-table walk on a miss\r
\r
/** Simulate a fully-associative, LRU TLB of \`size\` entries over a sequence of virtual-page accesses. */\r
export function simulate(accesses: number[], size: number): TlbResult {\r
  const tlb: number[] = []; // front = most-recently-used\r
  const steps: TlbStep[] = [];\r
  let hits = 0, misses = 0;\r
  for (const vpn of accesses) {\r
    const i = tlb.indexOf(vpn);\r
    let evicted: number | null = null;\r
    if (i >= 0) { hits++; tlb.splice(i, 1); tlb.unshift(vpn); steps.push({ vpn, hit: true, evicted, tlbAfter: [...tlb] }); }\r
    else {\r
      misses++;\r
      if (tlb.length >= size) evicted = tlb.pop()!; // evict the LRU entry\r
      tlb.unshift(vpn);\r
      steps.push({ vpn, hit: false, evicted, tlbAfter: [...tlb] });\r
    }\r
  }\r
  return { steps, hits, misses, hitRate: accesses.length ? hits / accesses.length : 0 };\r
}\r
\r
/** Average cycles per access with the TLB, vs always walking the page table (no TLB). */\r
export function cost(r: TlbResult, n: number) {\r
  const withTlb = (r.hits * HIT_CYCLES + r.misses * MISS_CYCLES) / (n || 1);\r
  return { withTlb, withoutTlb: MISS_CYCLES, speedup: MISS_CYCLES / (withTlb || 1) };\r
}\r
\r
/** A loop touching \`workingSet\` pages, repeated \`iters\` times — the classic locality vs thrash pattern. */\r
export const loopAccesses = (workingSet: number, iters: number): number[] =>\r
  Array.from({ length: iters }, () => Array.from({ length: workingSet }, (_, p) => p)).flat();\r
`;export{e as default};