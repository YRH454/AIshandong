var e=`// TCP Fast Open (RFC 7413) — shaving the handshake round-trip off repeat connections. Normal TCP\r
// makes you complete SYN → SYN-ACK → ACK before you may send a byte, so a short request pays a full\r
// RTT of pure setup latency. TFO lets the client put request DATA right in the SYN. The danger is that\r
// a SYN's source address is unverified, so accepting data + replying to a spoofed SYN is an\r
// amplification weapon. The fix is a COOKIE: on the first visit the server hands the client an\r
// encrypted token bound to its IP (a normal handshake, no savings yet); on later visits the client\r
// echoes the cookie alongside data in the SYN, the server validates it (proving the client received\r
// it at that IP before) and answers immediately — one RTT saved. A bad/missing cookie just falls back\r
// to a normal handshake. We model the packet exchange and the round-trip cost. Pure, tested.\r
\r
export interface TfoStep { from: 'client' | 'server'; label: string; carriesData: boolean }\r
export interface Conn { mode: string; steps: TfoStep[]; responseMs: number; savedMs: number; cookie: boolean }\r
\r
/** Plain TCP: full handshake before the request, response arrives 2 RTT after the SYN. */\r
export function normal(rttMs: number): Conn {\r
  return {\r
    mode: 'normal TCP',\r
    steps: [\r
      { from: 'client', label: 'SYN', carriesData: false },\r
      { from: 'server', label: 'SYN-ACK', carriesData: false },\r
      { from: 'client', label: 'ACK + request', carriesData: true }, // data only after the handshake\r
      { from: 'server', label: 'response', carriesData: true },\r
    ],\r
    responseMs: 2 * rttMs, // 1 RTT handshake + 1 RTT request/response\r
    savedMs: 0,\r
    cookie: false,\r
  };\r
}\r
\r
/** First TFO connection: a normal handshake that ALSO returns a cookie for next time. No RTT saved yet. */\r
export function firstTfo(rttMs: number): Conn {\r
  return {\r
    mode: 'TFO — first visit (get cookie)',\r
    steps: [\r
      { from: 'client', label: 'SYN (TFO cookie request)', carriesData: false },\r
      { from: 'server', label: 'SYN-ACK (cookie)', carriesData: false },\r
      { from: 'client', label: 'ACK + request', carriesData: true },\r
      { from: 'server', label: 'response', carriesData: true },\r
    ],\r
    responseMs: 2 * rttMs,\r
    savedMs: 0,\r
    cookie: true, // client now holds a cookie\r
  };\r
}\r
\r
/** Repeat TFO: data rides in the SYN. Valid cookie → 0-RTT data, response in ONE RTT; invalid → fallback. */\r
export function repeatTfo(rttMs: number, cookieValid: boolean): Conn {\r
  if (!cookieValid) {\r
    return {\r
      mode: 'TFO — bad cookie (fallback)',\r
      steps: [\r
        { from: 'client', label: 'SYN (stale cookie + data)', carriesData: true },\r
        { from: 'server', label: 'SYN-ACK (cookie ignored, data dropped)', carriesData: false },\r
        { from: 'client', label: 'ACK + request (resent)', carriesData: true },\r
        { from: 'server', label: 'response', carriesData: true },\r
      ],\r
      responseMs: 2 * rttMs, // no savings — server fell back to a normal handshake\r
      savedMs: 0,\r
      cookie: true,\r
    };\r
  }\r
  return {\r
    mode: 'TFO — repeat visit (0-RTT data)',\r
    steps: [\r
      { from: 'client', label: 'SYN (cookie + request data)', carriesData: true }, // request travels in the SYN\r
      { from: 'server', label: 'SYN-ACK + response', carriesData: true }, // server validates cookie, answers at once\r
    ],\r
    responseMs: rttMs, // the whole handshake RTT is saved\r
    savedMs: rttMs,\r
    cookie: true,\r
  };\r
}\r
`;export{e as default};