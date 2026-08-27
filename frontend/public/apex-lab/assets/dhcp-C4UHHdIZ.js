var e=`// DHCP — how a device gets an IP address with no prior configuration. The "DORA"\r
// exchange (RFC 2131): DISCOVER (client broadcasts "anyone out there?") → OFFER\r
// (a server proposes an address) → REQUEST (client broadcasts which offer it\r
// accepts, so other servers withdraw theirs) → ACK (the chosen server commits the\r
// lease). The lease has timers: at T1 (50%) the client renews by unicast to its\r
// server; at T2 (87.5%) it rebinds by broadcasting to any server; at expiry it must\r
// stop using the address and start over. Pure, tested model.\r
\r
export type Step = 'discover' | 'offer' | 'request' | 'ack' | 'bound' | 'renewing' | 'rebinding' | 'expired';\r
\r
export interface DhcpMessage {\r
  type: 'DISCOVER' | 'OFFER' | 'REQUEST' | 'ACK' | 'NAK';\r
  from: 'client' | 'server';\r
  broadcast: boolean; // L2/L3 broadcast vs unicast\r
  yourIp: string | null; // the offered/assigned address ('yiaddr')\r
  note: string;\r
}\r
\r
/** The four DORA messages for a fresh lease (RFC 2131 §3.1). */\r
// \`broadcastFlag\` = the client's B-flag. Per RFC 2131 §4.1, with it CLEAR (the default) the\r
// server UNICASTS the OFFER/ACK to the client's hardware address + offered IP; with it SET the\r
// server broadcasts them. DISCOVER and the selecting REQUEST are always broadcast.\r
export function doraMessages(offeredIp: string, serverIp: string, leaseSecs: number, broadcastFlag = false): DhcpMessage[] {\r
  const replyNote = broadcastFlag ? 'broadcast (the client set the B-flag)' : 'unicast to the client’s MAC + offered IP (B-flag clear)';\r
  return [\r
    { type: 'DISCOVER', from: 'client', broadcast: true, yourIp: null, note: 'The client has no IP yet, so it broadcasts to 255.255.255.255 from 0.0.0.0 — "is there a DHCP server?"' },\r
    { type: 'OFFER', from: 'server', broadcast: broadcastFlag, yourIp: offeredIp, note: \`Server \${serverIp} offers \${offeredIp} (\${replyNote}, RFC 2131 §4.1) with a \${leaseSecs}s lease.\` },\r
    { type: 'REQUEST', from: 'client', broadcast: true, yourIp: offeredIp, note: \`The client broadcasts which offer it accepts (naming \${serverIp}), so any OTHER server that offered can take its address back.\` },\r
    { type: 'ACK', from: 'server', broadcast: broadcastFlag, yourIp: offeredIp, note: \`The chosen server commits the lease: \${offeredIp} is yours for \${leaseSecs}s (\${replyNote}). The client may now use it.\` },\r
  ];\r
}\r
\r
export interface LeaseTimers {\r
  leaseSecs: number;\r
  t1: number; // renewal time (50%)\r
  t2: number; // rebinding time (87.5%)\r
  expiry: number; // 100%\r
}\r
\r
/** RFC 2131 §4.4.5 default timer fractions: T1 = 0.5·lease, T2 = 0.875·lease. */\r
export function leaseTimers(leaseSecs: number): LeaseTimers {\r
  return { leaseSecs, t1: Math.floor(leaseSecs * 0.5), t2: Math.floor(leaseSecs * 0.875), expiry: leaseSecs };\r
}\r
\r
export type LeasePhase = 'bound' | 'renewing' | 'rebinding' | 'expired';\r
\r
/** Which lease phase the client is in at \`elapsed\` seconds since the ACK. */\r
export function leasePhaseAt(elapsed: number, t: LeaseTimers): LeasePhase {\r
  if (elapsed >= t.expiry) return 'expired';\r
  if (elapsed >= t.t2) return 'rebinding';\r
  if (elapsed >= t.t1) return 'renewing';\r
  return 'bound';\r
}\r
\r
/** A renewal at T1: a UNICAST Request directly to the leasing server, then an Ack. */\r
export function renewMessages(ip: string, serverIp: string, leaseSecs: number): DhcpMessage[] {\r
  return [\r
    { type: 'REQUEST', from: 'client', broadcast: false, yourIp: ip, note: \`At T1 the client unicasts a REQUEST straight to \${serverIp} asking to keep \${ip} — no broadcast needed, it still has the address.\` },\r
    { type: 'ACK', from: 'server', broadcast: false, yourIp: ip, note: \`The server renews the lease: another \${leaseSecs}s. The timers reset and the client stays bound.\` },\r
  ];\r
}\r
`;export{e as default};