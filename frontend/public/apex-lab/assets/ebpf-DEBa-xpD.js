var e=`// eBPF and its verifier. eBPF lets you load your own programs into the running kernel — attached to hooks like XDP (on\r
// the NIC), kprobes (on any function), or LSM (on security decisions). Untrusted code in the kernel would be insane\r
// without a catch: before loading, a static VERIFIER walks every path of the program and proves it is safe — it\r
// terminates (loops must have a compile-time bound), never reads or writes out of bounds, stays under a complexity\r
// limit, and calls only the helpers its program type allows. Fail any check and the program is rejected and never runs.\r
// This models those accept/reject rules and a tiny XDP packet filter; the checks match what the real verifier enforces,\r
// though the real one is a full abstract interpreter over the instruction stream.\r
\r
// Toggleable properties of the XDP program you're writing. Each \`true\` is the safe choice.\r
export interface Program {\r
  boundedLoop: boolean;   // false → an unbounded loop: the verifier can't prove it terminates\r
  checksBounds: boolean;  // false → reads packet data without checking data_end first\r
  smallEnough: boolean;   // false → exceeds the instruction / complexity limit\r
  safeHelpers: boolean;   // false → calls a helper not permitted for XDP programs\r
}\r
\r
export interface Verdict { loaded: boolean; reason: string }\r
\r
// The verifier's checks, in the order it would reject. All must pass for the program to load.\r
export function verify(p: Program): Verdict {\r
  if (!p.boundedLoop) return { loaded: false, reason: 'rejected: back-edge without a bound — the verifier can’t prove the loop terminates, and a kernel that hangs is a dead machine.' };\r
  if (!p.checksBounds) return { loaded: false, reason: 'rejected: invalid memory access — the program reads packet bytes without first checking them against data_end, so it could read past the packet.' };\r
  if (!p.smallEnough) return { loaded: false, reason: 'rejected: program too large — it exceeds the instruction/complexity limit the verifier will analyze (it must check every path).' };\r
  if (!p.safeHelpers) return { loaded: false, reason: 'rejected: unknown or disallowed helper — an XDP program may only call the helpers permitted for its program type.' };\r
  return { loaded: true, reason: 'accepted: the verifier proved every path terminates, stays in bounds, and is small enough — the JIT compiles it to native code and attaches it to the NIC.' };\r
}\r
\r
export interface Packet { id: number; src: string; flood: boolean }  // flood = source is on the blocklist\r
export interface PacketResult { packet: Packet; action: 'DROP' | 'PASS' }\r
\r
// The XDP hook runs the program on every packet BEFORE the kernel network stack sees it. Our program drops blocklisted\r
// sources. If the program never loaded (verifier rejected it), nothing runs at the hook and every packet passes.\r
export function runXdp(loaded: boolean, packets: Packet[]): PacketResult[] {\r
  return packets.map((p) => ({ packet: p, action: loaded && p.flood ? 'DROP' : 'PASS' }));\r
}\r
\r
export interface Score { dropped: number; floodThrough: number; legitPassed: number }\r
export function score(results: PacketResult[]): Score {\r
  let dropped = 0, floodThrough = 0, legitPassed = 0;\r
  for (const r of results) {\r
    if (r.action === 'DROP') dropped++;\r
    else if (r.packet.flood) floodThrough++;\r
    else legitPassed++;\r
  }\r
  return { dropped, floodThrough, legitPassed };\r
}\r
\r
export const DEFAULT_PACKETS = (): Packet[] => [\r
  { id: 1, src: '203.0.113.7', flood: true }, { id: 2, src: '198.51.100.4', flood: false },\r
  { id: 3, src: '203.0.113.7', flood: true }, { id: 4, src: '203.0.113.7', flood: true },\r
  { id: 5, src: '198.51.100.9', flood: false }, { id: 6, src: '203.0.113.7', flood: true },\r
  { id: 7, src: '198.51.100.4', flood: false }, { id: 8, src: '203.0.113.7', flood: true },\r
];\r
`;export{e as default};