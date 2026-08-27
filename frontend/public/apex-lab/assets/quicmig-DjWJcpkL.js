var e=`// QUIC connection migration — why a QUIC download survives you walking out of wifi onto cellular, while a\r
// TCP one dies. The root difference is HOW the receiver finds the connection an arriving packet belongs to.\r
// TCP demuxes on the 4-tuple (src IP, src port, dst IP, dst port); change your IP and the tuple no longer\r
// matches any socket — the connection is gone, and you pay a full reconnect (TCP + TLS handshake + slow\r
// start). QUIC puts an explicit CONNECTION ID in every packet header, independent of addresses, so the same\r
// connection is recognized from a brand-new IP. To stop an attacker from redirecting a flow by spoofing a\r
// source address, the server first PATH-VALIDATES the new address (PATH_CHALLENGE → PATH_RESPONSE) and is\r
// anti-amplification-limited until it does. The client can also rotate to a fresh connection ID per path so\r
// observers can't link the two networks to one user. Reference: RFC 9000 §9 (Connection Migration).\r
\r
export type Proto = 'tcp' | 'quic';\r
export interface Endpoint { ip: string; port: number }\r
\r
/** The key the receiver uses to find the connection for an incoming packet. */\r
export function demuxKey(proto: Proto, client: Endpoint, server: Endpoint, connId: string): string {\r
  return proto === 'tcp'\r
    ? \`\${client.ip}:\${client.port}->\${server.ip}:\${server.port}\` // 4-tuple\r
    : \`cid:\${connId}\`;                                            // connection ID, address-independent\r
}\r
\r
export interface Recovery { rtts: number; reconnect: boolean; resetCwnd: boolean; steps: string[] }\r
export interface MigrateResult {\r
  proto: Proto; oldKey: string; newKey: string; matched: boolean; survives: boolean; recovery: Recovery;\r
}\r
\r
/** A client's network changes (new IP/port). Does the existing connection survive, and at what cost? */\r
export function migrate(proto: Proto, oldClient: Endpoint, newClient: Endpoint, server: Endpoint, connId: string): MigrateResult {\r
  const oldKey = demuxKey(proto, oldClient, server, connId);\r
  const newKey = demuxKey(proto, newClient, server, connId);\r
  const matched = oldKey === newKey;\r
\r
  const recovery: Recovery = matched\r
    ? {\r
        // QUIC: same connection ID → recognized. Validate the new path, then keep going. Congestion control\r
        // resets to be cautious on the unknown path, but there is NO handshake and data need not stop.\r
        rtts: 1, reconnect: false, resetCwnd: true,\r
        steps: [\r
          'client sends app packets with the SAME connection ID from the new address',\r
          'server recognizes the connection ID, but the source address is new',\r
          'server → PATH_CHALLENGE (random token) to the new address (anti-amplification limited until validated)',\r
          'client → PATH_RESPONSE (echoes the token), proving it owns the new path',\r
          'server validates the path and migrates; resets the congestion controller for the new link',\r
        ],\r
      }\r
    : {\r
        // TCP: the 4-tuple changed → no matching socket → the connection is dead. Full reconnect.\r
        rtts: 2, reconnect: true, resetCwnd: true,\r
        steps: [\r
          'packet arrives with a new 4-tuple → no matching socket → RST / silently dropped',\r
          'application must open a NEW connection',\r
          'TCP handshake (SYN / SYN-ACK / ACK) — 1 RTT',\r
          'TLS 1.3 handshake — 1 RTT',\r
          'congestion window resets to the initial window — slow start from scratch',\r
        ],\r
      };\r
\r
  return { proto, oldKey, newKey, matched, survives: matched, recovery };\r
}\r
`;export{e as default};