var e=`// ICMP (RFC 792) — the internet's control & error channel. When something goes\r
// wrong forwarding an IP packet (TTL hit 0, no route, packet too big with DF set), a\r
// router sends back an ICMP message naming the problem. Tools like ping (Echo) and\r
// traceroute (Time Exceeded) are built on it. This is the canonical type/code table,\r
// with cross-links to the Apex sections that already show these messages in action.\r
\r
export type Category = 'query' | 'error';\r
\r
export interface IcmpCode { code: number; meaning: string }\r
export interface IcmpType {\r
  type: number;\r
  name: string;\r
  category: Category;\r
  codes: IcmpCode[];\r
  trigger: string;\r
  seenIn?: string; // a section id where Apex demonstrates this message\r
}\r
\r
export const ICMP_TYPES: IcmpType[] = [\r
  {\r
    type: 0, name: 'Echo Reply', category: 'query', codes: [{ code: 0, meaning: 'Echo reply' }],\r
    trigger: 'Sent in response to an Echo Request — this is the “pong” of ping.',\r
  },\r
  {\r
    type: 3, name: 'Destination Unreachable', category: 'error',\r
    codes: [\r
      { code: 0, meaning: 'Net unreachable' },\r
      { code: 1, meaning: 'Host unreachable' },\r
      { code: 3, meaning: 'Port unreachable' },\r
      { code: 4, meaning: 'Fragmentation needed and DF set' },\r
    ],\r
    trigger: 'A router or host can’t deliver the packet — no route, no host, no listener on that port, or it’s too big to forward without fragmenting (code 4 drives Path-MTU Discovery).',\r
    seenIn: 'fragment',\r
  },\r
  {\r
    type: 4, name: 'Source Quench', category: 'error', codes: [{ code: 0, meaning: 'Source quench (deprecated)' }],\r
    trigger: 'A primitive “slow down” a congested router could send. Deprecated (RFC 6633) — congestion is handled by TCP and ECN now.',\r
    seenIn: 'congestion',\r
  },\r
  {\r
    type: 5, name: 'Redirect', category: 'error',\r
    codes: [\r
      { code: 0, meaning: 'Redirect for the network' },\r
      { code: 1, meaning: 'Redirect for the host' },\r
    ],\r
    trigger: 'A router tells a host “there’s a better next-hop for this destination — use that gateway instead”. Often disabled, since it’s abusable for traffic interception.',\r
  },\r
  {\r
    type: 8, name: 'Echo Request', category: 'query', codes: [{ code: 0, meaning: 'Echo request' }],\r
    trigger: 'The “ping” — asks the target to echo this payload back, measuring reachability and round-trip time.',\r
  },\r
  {\r
    type: 11, name: 'Time Exceeded', category: 'error',\r
    codes: [\r
      { code: 0, meaning: 'TTL exceeded in transit' },\r
      { code: 1, meaning: 'Fragment reassembly time exceeded' },\r
    ],\r
    trigger: 'A router decremented the TTL to 0 and dropped the packet (code 0) — exactly what traceroute exploits to map each hop. Code 1 fires when not all fragments of a datagram arrived in time.',\r
    seenIn: 'traceroute',\r
  },\r
  {\r
    type: 12, name: 'Parameter Problem', category: 'error', codes: [{ code: 0, meaning: 'Pointer indicates the error' }],\r
    trigger: 'The IP header itself is malformed (a bad field or option); the message points at the offending byte.',\r
  },\r
];\r
\r
export const byCategory = (cat: Category): IcmpType[] => ICMP_TYPES.filter((t) => t.category === cat);\r
export const findType = (type: number): IcmpType | undefined => ICMP_TYPES.find((t) => t.type === type);\r
`;export{e as default};