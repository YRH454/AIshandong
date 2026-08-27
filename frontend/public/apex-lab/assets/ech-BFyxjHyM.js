var e=`// ECH — Encrypted Client Hello — and why it's necessary but not sufficient. Even with TLS 1.3, the ClientHello carries\r
// the server name (SNI) in PLAINTEXT, so an on-path censor sees exactly which site you asked for. ECH encrypts the real\r
// ClientHello (with the true SNI) under a public key the client fetched from the server's DNS HTTPS record, and wraps\r
// it in an OUTER ClientHello that shows only a generic cover name. But a censor has other ways to identify the\r
// destination: the plaintext DNS query (unless you use DoH/DoT), and the destination IP (unless the site shares it with\r
// many others behind the same front). ECH closes the SNI channel; it only actually hides you when the DNS and IP\r
// channels are closed too. This models what each channel reveals and whether the censor can therefore block.\r
\r
export interface Config { echOn: boolean; privateDns: boolean; sharedFront: boolean }\r
\r
export const REAL_SNI = 'library.blocked.org';   // the site the censor wants to block\r
export const COVER_SNI = 'cdn.bigcloud.net';     // the shared front's generic name\r
\r
export type Leak = 'sni' | 'dns' | 'ip' | null;\r
export interface Analysis {\r
  visibleSni: string;   // what the SNI field on the wire shows\r
  dnsVisible: string;   // what the DNS query reveals ('' if private)\r
  ipShared: boolean;\r
  leak: Leak;           // the first channel that still identifies the destination\r
  blocked: boolean;\r
  reason: string;\r
}\r
\r
export function analyze(cfg: Config): Analysis {\r
  const visibleSni = cfg.echOn ? COVER_SNI : REAL_SNI;\r
  const dnsVisible = cfg.privateDns ? '' : REAL_SNI;\r
\r
  let leak: Leak = null;\r
  let reason: string;\r
  if (!cfg.echOn) {\r
    leak = 'sni';\r
    reason = \`The ClientHello SNI is plaintext, so the censor reads "\${REAL_SNI}" straight off the wire and blocks it. This is the leak ECH exists to close.\`;\r
  } else if (!cfg.privateDns) {\r
    leak = 'dns';\r
    reason = \`ECH hid the SNI, but the DNS lookup for "\${REAL_SNI}" went out in plaintext — the censor blocks on the query. ECH needs DoH/DoT to matter.\`;\r
  } else if (!cfg.sharedFront) {\r
    leak = 'ip';\r
    reason = \`SNI and DNS are hidden, but "\${REAL_SNI}" is the only site on its IP, so the censor blocks the destination address. ECH needs a large shared front (an anonymity set) to help.\`;\r
  } else {\r
    reason = \`The censor sees only the cover name "\${COVER_SNI}", an encrypted DNS lookup, and an IP shared by thousands of sites — it can't tell you asked for "\${REAL_SNI}" without blocking the whole front.\`;\r
  }\r
  return { visibleSni, dnsVisible, ipShared: cfg.sharedFront, leak, blocked: leak !== null, reason };\r
}\r
`;export{e as default};