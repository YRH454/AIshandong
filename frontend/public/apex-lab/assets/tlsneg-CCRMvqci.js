var e=`// TLS cipher-suite negotiation and the downgrade attack. The client offers a list\r
// of suites in preference order; the server picks the strongest it also supports.\r
// An active attacker who can edit the ClientHello strips the strong options, forcing\r
// a weak or export-grade suite the attacker can then break — FREAK, Logjam, POODLE,\r
// Sweet32 all worked this way. The Finished MAC over the transcript is what SHOULD\r
// catch the tampering — but it is only as strong as the key exchange it is keyed with:\r
// against an EXPORT key exchange (40-bit RSA / 512-bit DH) the attacker recovers the\r
// master secret and FORGES a matching Finished, which is exactly why FREAK and Logjam\r
// beat handshake integrity. The real closure was removing export suites entirely (and,\r
// for VERSION downgrade, the TLS 1.3 ServerRandom sentinel). Pure model (tested).\r
\r
export type Strength = 'strong' | 'legacy' | 'weak' | 'broken';\r
export const RANK: Record<Strength, number> = { strong: 3, legacy: 2, weak: 1, broken: 0 };\r
\r
export interface Suite {\r
  id: string;\r
  fs: boolean; // forward secrecy (ephemeral key exchange)?\r
  enc: string;\r
  strength: Strength;\r
  attack?: string; // the historical break this suite enables\r
  exportGrade?: boolean; // export KEX: the attacker can recover the master secret → forge the Finished MAC\r
}\r
\r
// Strongest → weakest. Real suite names.\r
export const SUITES: Suite[] = [\r
  { id: 'TLS_AES_256_GCM_SHA384', fs: true, enc: 'AES-256-GCM', strength: 'strong' },\r
  { id: 'TLS_CHACHA20_POLY1305_SHA256', fs: true, enc: 'ChaCha20-Poly1305', strength: 'strong' },\r
  { id: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256', fs: true, enc: 'AES-128-GCM', strength: 'strong' },\r
  { id: 'TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA', fs: true, enc: 'AES-128-CBC + SHA1', strength: 'legacy', attack: 'CBC/SHA-1: BEAST, Lucky13' },\r
  { id: 'TLS_RSA_WITH_AES_128_CBC_SHA', fs: false, enc: 'AES-128-CBC + SHA1', strength: 'legacy', attack: 'RSA key exchange: no forward secrecy' },\r
  { id: 'TLS_RSA_WITH_3DES_EDE_CBC_SHA', fs: false, enc: '3DES-CBC', strength: 'weak', attack: 'Sweet32 (64-bit block birthday)' },\r
  { id: 'TLS_RSA_WITH_RC4_128_SHA', fs: false, enc: 'RC4', strength: 'weak', attack: 'RC4 keystream biases' },\r
  { id: 'TLS_RSA_EXPORT_WITH_RC4_40_MD5', fs: false, enc: 'RC4-40 (export)', strength: 'broken', attack: 'FREAK — 40-bit RSA export', exportGrade: true },\r
  { id: 'TLS_DHE_RSA_EXPORT_WITH_DES40_CBC_SHA', fs: true, enc: 'DES-40 (export)', strength: 'broken', attack: 'Logjam — 512-bit export DH', exportGrade: true },\r
];\r
\r
/** The server picks the strongest suite that appears in BOTH lists. */\r
export function negotiate(offered: Suite[], serverSupports: Suite[]): Suite | null {\r
  const ids = new Set(serverSupports.map((s) => s.id));\r
  const mutual = offered.filter((s) => ids.has(s.id));\r
  if (mutual.length === 0) return null;\r
  return mutual.reduce((best, s) => (RANK[s.strength] > RANK[best.strength] ? s : best));\r
}\r
\r
/** An on-path attacker rewrites the ClientHello, dropping anything stronger than \`cap\`. */\r
export function strip(offered: Suite[], cap: Strength): Suite[] {\r
  return offered.filter((s) => RANK[s.strength] <= RANK[cap]);\r
}\r
\r
/** Was the client forced below what it would have gotten untouched? */\r
export function isDowngrade(unmolested: Suite | null, actual: Suite | null): boolean {\r
  if (!unmolested || !actual) return false;\r
  return RANK[actual.strength] < RANK[unmolested.strength];\r
}\r
\r
export type Outcome = 'secure' | 'detected' | 'forged' | 'broken';\r
\r
/** The honest verdict once a suite is negotiated. With handshake integrity on, the Finished MAC over the\r
 *  transcript makes the endpoints notice a stripped ClientHello — UNLESS the forced suite has an EXPORT key\r
 *  exchange, in which case the attacker recovers the master secret and forges a matching Finished. That single\r
 *  exception is FREAK/Logjam: the Finished MAC is present and still bypassed, so integrity alone is not enough —\r
 *  removing export suites is what actually closed it. */\r
export function outcome(actual: Suite, downgraded: boolean, integrity: boolean): Outcome {\r
  if (!downgraded) return 'secure';\r
  if (!integrity) return 'broken';                    // no integrity: any downgrade sticks silently\r
  return actual.exportGrade ? 'forged' : 'detected';  // export KEX → Finished forged; else the MAC catches it\r
}\r
`;export{e as default};