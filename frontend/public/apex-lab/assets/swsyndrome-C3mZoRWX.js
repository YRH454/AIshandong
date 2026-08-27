var e=`// Silly Window Syndrome (SWS) — a TCP flow-control pathology where a connection degenerates into sending a\r
// flood of tiny segments, so almost all the bandwidth is wasted on packet headers instead of data. TCP's\r
// receiver advertises a "window": how much buffer space it has free. The bug appears when an application reads\r
// its received data very slowly — a byte or a few bytes at a time. Each little read frees a little space, the\r
// receiver dutifully advertises that tiny new window, and an eager sender immediately fires off a segment just\r
// big enough to fill it. The result: 1-byte payloads wrapped in 40 bytes of TCP/IP header — 40x overhead, the\r
// "silly window." Every full segment carries MSS (~1460) bytes of payload for the same 40-byte header, so the\r
// cure is to stop sending (or advertising) dribbles. Two coordinated fixes: the RECEIVER (Clark's algorithm)\r
// refuses to advertise a bigger window until it can offer at least a full MSS or half its buffer — it hides the\r
// small openings; and the SENDER (Nagle's algorithm) refuses to transmit a small segment while it still has\r
// unacknowledged small data outstanding, coalescing bytes into full segments instead. This models the transfer\r
// arithmetic: how segment size drives header overhead and goodput. Reference: RFC 813 (SWS avoidance); RFC 896\r
// (Nagle); RFC 1122.\r
\r
export interface Transfer {\r
  segments: number;    // how many segments the payload is chopped into\r
  segSize: number;     // payload bytes per segment\r
  payload: number;     // useful bytes delivered\r
  headerBytes: number; // total header overhead\r
  wireBytes: number;   // bytes actually put on the wire (payload + headers)\r
  efficiency: number;  // goodput ratio = payload / wireBytes\r
}\r
\r
/** Send \`payload\` bytes in segments of \`segSize\` payload each, with \`header\` bytes of overhead per segment. */\r
export function transfer(payload: number, segSize: number, header = 40): Transfer {\r
  const seg = Math.max(1, Math.floor(segSize));\r
  const segments = Math.ceil(payload / seg);\r
  const headerBytes = segments * header;\r
  const wireBytes = payload + headerBytes;\r
  return { segments, segSize: seg, payload, headerBytes, wireBytes, efficiency: wireBytes === 0 ? 1 : payload / wireBytes };\r
}\r
\r
/** SWS scenario: a slow reader frees \`readChunk\` bytes at a time. Naive TCP sends readChunk-sized segments;\r
 *  with SWS avoidance the data is coalesced into full-MSS segments. */\r
export function scenario(payload: number, readChunk: number, mss = 1460, header = 40): { naive: Transfer; avoided: Transfer; speedup: number } {\r
  const naive = transfer(payload, readChunk, header);          // tiny segments driven by the slow reader\r
  const avoided = transfer(payload, mss, header);              // Clark + Nagle coalesce to full segments\r
  return { naive, avoided, speedup: naive.wireBytes / avoided.wireBytes };\r
}\r
`;export{e as default};