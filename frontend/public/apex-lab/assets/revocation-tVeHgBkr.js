var e=`// Certificate revocation & transparency — the two problems a cert's expiry date can't\r
// solve. (1) Revocation: a key is stolen today but the cert is valid till next year —\r
// how does a browser learn to distrust it? CRL (download the whole revoked list),\r
// OCSP (ask the CA per-cert, leaking your browsing to the CA), or OCSP stapling (the\r
// server fetches a signed "still good" proof and staples it into the handshake — no\r
// client→CA call). (2) Mis-issuance: a CA wrongly issues yourbank.com to an attacker.\r
// Certificate Transparency forces every cert into public append-only Merkle logs, and\r
// browsers require a log proof (SCT), so domain owners monitoring the logs catch it.\r
// Pure model (tested).\r
\r
export type RevMethod = 'crl' | 'ocsp' | 'stapling';\r
\r
export interface MethodInfo {\r
  id: RevMethod;\r
  label: string;\r
  clientContactsCA: boolean; // does the browser have to talk to the CA?\r
  privacy: 'leaks' | 'private';\r
  freshness: string;\r
  cost: string;\r
  note: string;\r
}\r
\r
export const METHODS: MethodInfo[] = [\r
  { id: 'crl', label: 'CRL', clientContactsCA: true, privacy: 'private', freshness: 'stale (cached list)', cost: 'big download', note: 'The CA publishes one big signed list of revoked serials; the browser downloads and caches it. Doesn’t leak which site you visit, but the list is large and often out of date.' },\r
  { id: 'ocsp', label: 'OCSP', clientContactsCA: true, privacy: 'leaks', freshness: 'fresh', cost: 'extra round trip', note: 'The browser asks the CA’s responder “is serial N still valid?” per cert — fresh, but it adds latency and tells the CA every site you visit. A failed lookup is usually soft-failed (ignored), which attackers exploit.' },\r
  { id: 'stapling', label: 'OCSP stapling', clientContactsCA: false, privacy: 'private', freshness: 'fresh', cost: 'free (in handshake)', note: 'The server fetches a short-lived signed OCSP response itself and staples it into the TLS handshake. The browser gets a fresh proof with no extra call and no privacy leak — the modern default (with Must-Staple to close the soft-fail hole).' },\r
];\r
\r
export const byId = (id: RevMethod): MethodInfo => METHODS.find((m) => m.id === id)!;\r
\r
/** Revocation check: is this serial on the revoked set? */\r
export const status = (serial: number, revoked: Set<number>): 'revoked' | 'good' => (revoked.has(serial) ? 'revoked' : 'good');\r
\r
// ── Certificate Transparency ────────────────────────────────────────────────\r
export interface CtEntry { serial: number; domain: string; issuedBy: string; sct: boolean }\r
\r
/** Browsers reject a cert without an SCT (proof it’s in a public log). */\r
export const browserAccepts = (e: CtEntry): boolean => e.sct;\r
\r
/** A domain owner monitoring the logs: any cert for THEIR domain they didn't request\r
 *  is suspicious — that's how mis-issuance is caught in public. */\r
export function monitor(log: CtEntry[], domain: string, myRequestedSerials: Set<number>): CtEntry[] {\r
  return log.filter((e) => e.domain === domain && !myRequestedSerials.has(e.serial));\r
}\r
`;export{e as default};