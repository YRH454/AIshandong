var e=`// Path MTU Discovery (RFC 1191). Every link has a Maximum Transmission Unit; the path's\r
// MTU is the smallest link along it. A sender that sets the Don't-Fragment bit and sends\r
// too large a packet gets it DROPPED at the narrow link, which returns an ICMP "Packet\r
// Too Big / fragmentation needed" (Type 3, Code 4) carrying that link's MTU. The sender\r
// shrinks and retries, converging on the path MTU. The failure mode: if a firewall eats\r
// those ICMP messages, the sender never learns — the connection just hangs on large\r
// transfers (a PMTUD "black hole"). Pure model; tested on a worked path.\r
\r
export interface Link { name: string; mtu: number }\r
\r
export interface Attempt {\r
  size: number;        // packet size tried\r
  droppedAtHop: number | null; // index of the link that dropped it (null = delivered)\r
  icmpMtu: number | null;      // next-hop MTU returned by ICMP (null if blocked or delivered)\r
  delivered: boolean;\r
}\r
\r
export interface Result { attempts: Attempt[]; pathMtu: number | null; blackHole: boolean }\r
\r
/** Run PMTUD across \`links\` starting from \`initialSize\` with DF set. */\r
export function pmtud(links: Link[], initialSize: number, icmpBlocked = false): Result {\r
  const attempts: Attempt[] = [];\r
  let size = initialSize;\r
  const truePathMtu = Math.min(...links.map((l) => l.mtu));\r
\r
  for (let guard = 0; guard < links.length + 2; guard++) {\r
    const hop = links.findIndex((l) => size > l.mtu); // first link too small for this packet\r
    if (hop === -1) {\r
      attempts.push({ size, droppedAtHop: null, icmpMtu: null, delivered: true });\r
      return { attempts, pathMtu: size, blackHole: false };\r
    }\r
    if (icmpBlocked) {\r
      // dropped, and the ICMP that would teach the sender never arrives → black hole\r
      attempts.push({ size, droppedAtHop: hop, icmpMtu: null, delivered: false });\r
      return { attempts, pathMtu: null, blackHole: true };\r
    }\r
    const icmpMtu = links[hop].mtu;\r
    attempts.push({ size, droppedAtHop: hop, icmpMtu, delivered: false });\r
    size = icmpMtu; // shrink to what the ICMP reported and retry\r
  }\r
  // safety net (shouldn't be reached for a sane path)\r
  return { attempts, pathMtu: truePathMtu, blackHole: false };\r
}\r
`;export{e as default};