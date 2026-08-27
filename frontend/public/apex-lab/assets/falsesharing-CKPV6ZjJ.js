var e=`// False sharing — the performance bug where two CPU cores fight over a cache line even though they touch\r
// completely different variables. Caches move memory in 64-byte LINES, not individual bytes. If thread A's\r
// counter and thread B's counter happen to sit in the SAME 64-byte line, then every time A writes its counter,\r
// the coherence protocol (MESI) must invalidate B's copy of the line to keep things consistent — and vice\r
// versa. So the line ricochets between the two cores' caches on every write, each bounce a ~100-cycle coherence\r
// miss, even though the two threads never read or write the SAME variable. It's "false" sharing because there's\r
// no real data dependency — just an accident of memory layout. The fix is to PAD the variables apart so each\r
// lands on its own line (or align them to a cache line). This is one of the most common invisible scaling\r
// killers in multithreaded code: add a thread and it gets SLOWER. This models the coherence traffic with vs\r
// without padding. Reference: Intel/AMD cache-coherence docs; the classic "@Contended" / cacheline-padding fix.\r
\r
export const LINE = 64; // cache line size in bytes\r
\r
export interface Layout { offsetA: number; offsetB: number } // byte offsets of the two counters\r
export const sameLine = (l: Layout): boolean => Math.floor(l.offsetA / LINE) === Math.floor(l.offsetB / LINE);\r
\r
export interface Result {\r
  sameLine: boolean;\r
  transfers: number;   // cache-line bounces between cores (coherence misses)\r
  writes: number;\r
  cycles: number;      // total cycles for the write stream on this layout\r
  idealCycles: number; // cycles if every write hit L1 (no contention)\r
  slowdown: number;    // cycles / idealCycles\r
}\r
\r
/** Simulate a stream of writes by two threads over a memory layout, counting cache-line bounces. */\r
export function simulate(layout: Layout, sequence: ('A' | 'B')[], hit = 4, miss = 100): Result {\r
  const same = sameLine(layout);\r
  let transfers = 0;\r
  if (same) {\r
    // one shared line: it lives in whichever core wrote last; a different writer must pull it over (a bounce)\r
    let owner: string | null = null;\r
    for (const w of sequence) if (owner !== w) { transfers++; owner = w; }\r
  }\r
  // padded → each thread keeps its own line in Modified state, every write is an L1 hit\r
  const cycles = same ? transfers * miss + (sequence.length - transfers) * hit : sequence.length * hit;\r
  const idealCycles = sequence.length * hit;\r
  return { sameLine: same, transfers, writes: sequence.length, cycles, idealCycles, slowdown: cycles / idealCycles };\r
}\r
\r
/** Perfectly interleaved writes (two threads hammering in lockstep) — the worst case. */\r
export const interleaved = (n: number): ('A' | 'B')[] => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'A' : 'B'));\r
/** Bursty writes (each thread does a run before yielding) — much less contention even when sharing a line. */\r
export const bursty = (n: number, run: number): ('A' | 'B')[] => Array.from({ length: n }, (_, i) => (Math.floor(i / run) % 2 === 0 ? 'A' : 'B'));\r
`;export{e as default};