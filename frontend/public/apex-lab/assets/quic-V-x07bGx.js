var e=`// QUIC vs TCP+TLS — how many round trips before the first application data flows.\r
// The headline win of QUIC (RFC 9000/9001) is folding the transport and crypto\r
// handshakes together: TCP+TLS 1.3 spends one RTT on the TCP handshake and another\r
// on TLS before data; QUIC does it in one combined RTT, or ZERO on resumption\r
// (0-RTT) by reusing a cached secret. We model each as an ordered list of one-way\r
// messages and count completed round trips to first app data. Pure, tested.\r
\r
export type Side = 'client' | 'server';\r
export interface Msg {\r
  from: Side;\r
  label: string;\r
  rtt: number; // which round trip (0-based) this message belongs to\r
  appData?: boolean; // does this message carry the first application data?\r
  note: string;\r
}\r
\r
export interface Scenario {\r
  id: string;\r
  name: string;\r
  rttToFirstData: number; // round trips before the client's first app data is sent\r
  messages: Msg[];\r
}\r
\r
/** TCP three-way handshake, then a TLS 1.3 handshake, then HTTP — two RTTs of setup. */\r
export function tcpTls(): Scenario {\r
  return {\r
    id: 'tcp-tls', name: 'TCP + TLS 1.3', rttToFirstData: 2,\r
    messages: [\r
      { from: 'client', label: 'SYN', rtt: 0, note: 'TCP handshake begins — no data may be sent yet.' },\r
      { from: 'server', label: 'SYN-ACK', rtt: 0, note: 'Server agrees to the connection.' },\r
      { from: 'client', label: 'ACK + ClientHello', rtt: 1, note: 'TCP is established; only now can the TLS handshake start (ClientHello piggybacks the ACK).' },\r
      { from: 'server', label: 'ServerHello … Finished', rtt: 1, note: 'TLS 1.3 server flight: key share, certificate, Finished — all encrypted from EncryptedExtensions on.' },\r
      { from: 'client', label: 'Finished + GET /', rtt: 2, appData: true, note: 'Client Finished completes TLS; the first HTTP request goes out — 2 full RTTs after the first packet.' },\r
    ],\r
  };\r
}\r
\r
/** QUIC 1-RTT: the transport + TLS handshake are combined into a single round trip. */\r
export function quic1Rtt(): Scenario {\r
  return {\r
    id: 'quic-1rtt', name: 'QUIC (1-RTT)', rttToFirstData: 1,\r
    messages: [\r
      { from: 'client', label: 'Initial: ClientHello', rtt: 0, note: 'QUIC carries the TLS ClientHello inside its very first packet — transport and crypto start together.' },\r
      { from: 'server', label: 'Initial + Handshake: ServerHello … Finished', rtt: 0, note: 'Server returns its TLS flight in the same round trip; there is no separate transport handshake.' },\r
      { from: 'client', label: 'Finished + GET /', rtt: 1, appData: true, note: 'Client Finished + the first request — 1 RTT after the first packet, half of TCP+TLS.' },\r
    ],\r
  };\r
}\r
\r
/** QUIC 0-RTT: a resumed connection sends application data in the very first packet. */\r
export function quic0Rtt(): Scenario {\r
  return {\r
    id: 'quic-0rtt', name: 'QUIC (0-RTT resumption)', rttToFirstData: 0,\r
    messages: [\r
      { from: 'client', label: 'Initial + 0-RTT: ClientHello + GET /', rtt: 0, appData: true, note: 'On a resumed session the client reuses a cached secret to encrypt a request in the FIRST packet — zero round trips of waiting.' },\r
      { from: 'server', label: 'ServerHello … Finished + response', rtt: 0, note: 'Server confirms the handshake and can answer immediately. (0-RTT data is replayable, so it is limited to safe, idempotent requests.)' },\r
    ],\r
  };\r
}\r
\r
export function allScenarios(): Scenario[] {\r
  return [tcpTls(), quic1Rtt(), quic0Rtt()];\r
}\r
\r
// ---- Transport-layer head-of-line blocking (one lost packet) -----------------\r
\r
export interface HolResult {\r
  protocol: 'TCP' | 'QUIC';\r
  lostStream: number;\r
  stalledStreams: number[]; // which streams are blocked waiting for the retransmit\r
  note: string;\r
}\r
\r
/**\r
 * One packet carrying stream \`lostStream\` is dropped while \`streams\` are in\r
 * flight. TCP delivers one ordered byte stream, so ALL streams stall until the\r
 * retransmit. QUIC delivers each stream independently, so only the lost one stalls.\r
 */\r
export function headOfLine(protocol: 'TCP' | 'QUIC', streams: number[], lostStream: number): HolResult {\r
  if (protocol === 'TCP') {\r
    return { protocol, lostStream, stalledStreams: streams.slice(), note: 'TCP is a single ordered stream: the receiver must hold every later byte — from every multiplexed stream — until the missing segment is retransmitted.' };\r
  }\r
  return { protocol, lostStream, stalledStreams: [lostStream], note: 'QUIC streams are delivered independently, so only the stream that lost a packet waits; the others keep flowing.' };\r
}\r
`;export{e as default};