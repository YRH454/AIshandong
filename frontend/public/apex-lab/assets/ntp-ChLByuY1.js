var e=`// NTP (RFC 5905) clock synchronization — how a client sets its clock from a server\r
// across a network whose delay it doesn't know. Four timestamps: T1 (client sends),\r
// T2 (server receives), T3 (server replies), T4 (client receives). Two subtractions\r
// recover both the round-trip delay and the clock offset, and — elegantly — the\r
// server's own processing time cancels out, and the offset is exact when the path is\r
// symmetric. The only error is path asymmetry. Pure formulas (tested).\r
\r
export interface Stamps { t1: number; t2: number; t3: number; t4: number }\r
export interface NtpResult { delay: number; offset: number }\r
\r
/** δ = (T4−T1) − (T3−T2) ;  θ = ((T2−T1) + (T3−T4)) / 2. */\r
export function compute(s: Stamps): NtpResult {\r
  return {\r
    delay: (s.t4 - s.t1) - (s.t3 - s.t2),\r
    offset: ((s.t2 - s.t1) + (s.t3 - s.t4)) / 2,\r
  };\r
}\r
\r
/**\r
 * Simulate the exchange. The server's clock leads the client's by \`trueOffset\`; the\r
 * request takes \`dUp\`, the reply \`dDown\`, and the server spends \`serverProc\` between\r
 * receiving and replying. Timestamps are written in each side's OWN clock.\r
 */\r
export function simulate(trueOffset: number, dUp: number, dDown: number, serverProc: number, t1 = 1000): Stamps {\r
  const t2 = t1 + dUp + trueOffset; // server clock when the request arrives\r
  const t3 = t2 + serverProc; // server clock when it replies\r
  const t4 = t1 + dUp + serverProc + dDown; // client clock when the reply arrives\r
  return { t1, t2, t3, t4 };\r
}\r
\r
/** The unavoidable error from an asymmetric path: (dUp − dDown) / 2. */\r
export const asymmetryError = (dUp: number, dDown: number): number => (dUp - dDown) / 2;\r
`;export{e as default};