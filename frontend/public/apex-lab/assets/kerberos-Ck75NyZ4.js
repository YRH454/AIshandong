var e=`// Kerberos (RFC 4120) — single sign-on without ever sending the password. Three\r
// exchanges, each a request/reply: AS (get a ticket-granting ticket), TGS (trade the\r
// TGT for a service ticket), AP (present the service ticket to the server). The trick\r
// is that the KDC shares a long-term key with every principal, so it can hand each\r
// side a session key sealed under a key only that side holds — and tickets are opaque\r
// to the client, who just relays them. We model who can read what; the encryption is\r
// honest about opacity (no invented plaintext for blobs the holder can't open).\r
\r
export type Key =\r
  | 'Kc' // client long-term key (derived from the password — never transmitted)\r
  | 'Ktgs' // TGS long-term key\r
  | 'Ksvc' // service long-term key\r
  | 'Kc_tgs' // client↔TGS session key (issued by AS)\r
  | 'Kc_svc'; // client↔service session key (issued by TGS)\r
\r
export interface Blob {\r
  label: string;\r
  encWith: Key; // which key this blob is sealed under\r
  readableBy: 'client' | 'tgs' | 'service'; // who holds that key\r
  contents: string[]; // what's inside (visible only to readableBy)\r
}\r
\r
export interface Step {\r
  n: number;\r
  exchange: 'AS' | 'TGS' | 'AP';\r
  from: string;\r
  to: string;\r
  msg: string;\r
  blobs: Blob[];\r
  note: string;\r
}\r
\r
const who: Record<Key, 'client' | 'tgs' | 'service'> = {\r
  Kc: 'client', Kc_tgs: 'client', Kc_svc: 'client', Ktgs: 'tgs', Ksvc: 'service',\r
};\r
\r
export function flow(): Step[] {\r
  const b = (label: string, encWith: Key, contents: string[]): Blob => ({ label, encWith, readableBy: who[encWith], contents });\r
  return [\r
    {\r
      n: 1, exchange: 'AS', from: 'client', to: 'AS (KDC)', msg: 'AS-REQ',\r
      blobs: [b('pre-auth', 'Kc', ['timestamp']), b('cleartext', 'Kc', ['principal: alice', 'wants: TGT'])],\r
      note: 'Alice proves she knows her password by encrypting a fresh timestamp with Kc (derived from it). The password itself never goes on the wire.',\r
    },\r
    {\r
      n: 2, exchange: 'AS', from: 'AS (KDC)', to: 'client', msg: 'AS-REP',\r
      blobs: [b('for the client', 'Kc', ['session key Kc_tgs', 'TGT expiry']), b('TGT', 'Ktgs', ['alice', 'session key Kc_tgs', 'expiry'])],\r
      note: 'The AS returns a session key Kc_tgs sealed with Kc (only Alice can open it) plus the TGT — sealed with the TGS key, so it is OPAQUE to Alice; she just stores and relays it.',\r
    },\r
    {\r
      n: 3, exchange: 'TGS', from: 'client', to: 'TGS (KDC)', msg: 'TGS-REQ',\r
      blobs: [b('TGT (relayed)', 'Ktgs', ['alice', 'session key Kc_tgs', 'expiry']), b('authenticator', 'Kc_tgs', ['alice', 'timestamp']), b('cleartext', 'Kc_tgs', ['wants: http/server'])],\r
      note: 'Alice sends back the opaque TGT plus a fresh authenticator sealed with Kc_tgs. The TGS opens the TGT, learns Kc_tgs, and uses it to verify the authenticator — proving she holds the session key, not a replay.',\r
    },\r
    {\r
      n: 4, exchange: 'TGS', from: 'TGS (KDC)', to: 'client', msg: 'TGS-REP',\r
      blobs: [b('for the client', 'Kc_tgs', ['session key Kc_svc', 'ticket expiry']), b('service ticket', 'Ksvc', ['alice', 'session key Kc_svc', 'expiry'])],\r
      note: 'A new service session key Kc_svc sealed with Kc_tgs, plus a service ticket sealed with the SERVICE’s key — again opaque to Alice. No password was needed: the TGT did the work (single sign-on).',\r
    },\r
    {\r
      n: 5, exchange: 'AP', from: 'client', to: 'service', msg: 'AP-REQ',\r
      blobs: [b('service ticket (relayed)', 'Ksvc', ['alice', 'session key Kc_svc', 'expiry']), b('authenticator', 'Kc_svc', ['alice', 'timestamp'])],\r
      note: 'Alice presents the opaque service ticket and an authenticator sealed with Kc_svc. The service opens the ticket with its own key, learns Kc_svc, and verifies the authenticator — the KDC never had to be online for this step.',\r
    },\r
    {\r
      n: 6, exchange: 'AP', from: 'service', to: 'client', msg: 'AP-REP',\r
      blobs: [b('mutual auth', 'Kc_svc', ['client timestamp (ctime/cusec, echoed)'])],\r
      note: 'Optional: the service echoes back the SAME timestamp from Alice’s authenticator (ctime/cusec, unchanged — RFC 4120 §5.5.2; the “+1” is the older Kerberos V4 style), sealed with Kc_svc. Only a server that could open the ticket and recover Kc_svc could produce it, so Alice knows she’s talking to the real server. Mutual authentication.',\r
    },\r
  ];\r
}\r
\r
/** Can \`party\` read this blob? (Only the holder of its key.) */\r
export const canRead = (blob: Blob, party: 'client' | 'tgs' | 'service'): boolean => blob.readableBy === party;\r
`;export{e as default};