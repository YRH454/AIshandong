var e=`// TCP Selective Acknowledgment (SACK, RFC 2018). A plain cumulative ACK can only say\r
// "I have everything up to byte X" — so when a segment is lost but later ones arrive, the\r
// sender is blind to what got through and may resend everything after the gap (go-back-N).\r
// SACK adds blocks that report the exact ranges received ABOVE the cumulative point, so\r
// the sender retransmits only the actual holes. This models the difference: which\r
// segments each strategy puts back on the wire. Pure and tested on a worked loss pattern.\r
\r
export interface SackInfo {\r
  cumulativeAck: number;       // highest in-order segment the receiver has (0 = none)\r
  highestReceived: number;     // highest segment number received at all\r
  sackBlocks: [number, number][]; // contiguous received ranges above the cumulative ack\r
  holes: number[];             // missing segments below the highest received\r
  retransmitWithSack: number[];    // SACK: just the holes\r
  retransmitGoBackN: number[];     // no SACK: everything after the cumulative ack\r
  saved: number;               // segments SACK avoids resending\r
}\r
\r
/** \`received[i]\` = was segment (i+1) received? Segments are numbered 1..N. */\r
export function analyze(received: boolean[]): SackInfo {\r
  const n = received.length;\r
  const has = (seg: number) => received[seg - 1];\r
\r
  let cumulativeAck = 0;\r
  while (cumulativeAck < n && has(cumulativeAck + 1)) cumulativeAck++;\r
\r
  let highestReceived = 0;\r
  for (let s = 1; s <= n; s++) if (has(s)) highestReceived = s;\r
\r
  // contiguous received blocks strictly above the cumulative ack\r
  const sackBlocks: [number, number][] = [];\r
  let start = -1;\r
  for (let s = cumulativeAck + 1; s <= highestReceived; s++) {\r
    if (has(s)) { if (start === -1) start = s; }\r
    else if (start !== -1) { sackBlocks.push([start, s - 1]); start = -1; }\r
  }\r
  if (start !== -1) sackBlocks.push([start, highestReceived]);\r
\r
  const holes: number[] = [];\r
  for (let s = cumulativeAck + 1; s <= highestReceived; s++) if (!has(s)) holes.push(s);\r
\r
  const retransmitGoBackN: number[] = [];\r
  for (let s = cumulativeAck + 1; s <= highestReceived; s++) retransmitGoBackN.push(s);\r
\r
  return {\r
    cumulativeAck, highestReceived, sackBlocks, holes,\r
    retransmitWithSack: holes.slice(),\r
    retransmitGoBackN,\r
    saved: retransmitGoBackN.length - holes.length,\r
  };\r
}\r
`;export{e as default};