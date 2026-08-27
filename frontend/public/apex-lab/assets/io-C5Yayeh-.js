var e=`// How the CPU moves data to and from a device — and the three answers, each trading CPU time for complexity.\r
// Say a disk or network card has N bytes for main memory. (1) PROGRAMMED I/O (polling): the CPU spins reading a\r
// status register until the device says "ready," then copies the byte itself, and repeats. Dead simple, but the\r
// CPU is 100% consumed for the whole transfer — every cycle spent waiting or copying is a cycle stolen from real\r
// work. (2) INTERRUPT-DRIVEN: the CPU tells the device "interrupt me when ready" and goes off to do other work;\r
// each time a byte arrives the device raises an IRQ, the CPU stops, saves its state, runs a short handler to copy\r
// the byte, and resumes. Now the CPU is free between bytes — but it pays a fixed interrupt overhead (context\r
// save/restore + dispatch, tens to hundreds of cycles) for EVERY byte, so a fast device drowns it in interrupts.\r
// (3) DMA (Direct Memory Access): the CPU programs a separate DMA controller once with a source, a destination,\r
// and a count, then forgets about it; the controller streams all N bytes straight into memory over the bus and\r
// raises just ONE interrupt at the very end. The CPU cost is now CONSTANT — a setup plus one interrupt — no matter\r
// how big the transfer, which is why every disk, NIC, GPU, and sound card uses DMA for bulk data (the controller\r
// only "steals" occasional bus cycles from the CPU). This models the CPU cycles each strategy costs to move N\r
// bytes. Reference: any OS/architecture text (Patterson & Hennessy; Tanenbaum).\r
\r
export type Strategy = 'polling' | 'interrupt' | 'dma';\r
export interface Costs { pollCycles: number; copyCycles: number; isrCycles: number; dmaSetup: number }\r
export const DEFAULTS: Costs = { pollCycles: 2, copyCycles: 1, isrCycles: 60, dmaSetup: 80 };\r
\r
export interface IoResult { strategy: Strategy; cpuCycles: number; interrupts: number; scalesWithN: boolean }\r
\r
/** CPU cycles STOLEN from useful work to move \`bytes\` bytes under a strategy. */\r
export function ioCost(strategy: Strategy, bytes: number, c: Costs = DEFAULTS): IoResult {\r
  switch (strategy) {\r
    case 'polling':   // CPU spins on status + copies every byte itself — busy the whole time\r
      return { strategy, cpuCycles: bytes * (c.pollCycles + c.copyCycles), interrupts: 0, scalesWithN: true };\r
    case 'interrupt': // one IRQ per byte: fixed handler overhead + copy, but CPU free between\r
      return { strategy, cpuCycles: bytes * (c.isrCycles + c.copyCycles), interrupts: bytes, scalesWithN: true };\r
    case 'dma':       // program the controller once, one completion IRQ — constant in N\r
      return { strategy, cpuCycles: c.dmaSetup + c.isrCycles, interrupts: 1, scalesWithN: false };\r
  }\r
}\r
\r
/** The smallest transfer size at which DMA costs the CPU less than interrupt-driven I/O. */\r
export function dmaCrossover(c: Costs = DEFAULTS): number {\r
  // dmaSetup + isr < bytes*(isr+copy)  →  bytes > (dmaSetup+isr)/(isr+copy)\r
  return Math.floor((c.dmaSetup + c.isrCycles) / (c.isrCycles + c.copyCycles)) + 1;\r
}\r
`;export{e as default};