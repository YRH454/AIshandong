var e=`// HSTS — HTTP Strict Transport Security (RFC 6797). The web's defense against SSL stripping: a server\r
// sends one header, "Strict-Transport-Security: max-age=...; includeSubDomains", and from then on the\r
// BROWSER itself rewrites every http:// request to that host into https:// BEFORE a single plaintext byte\r
// leaves the machine — closing the door on a man-in-the-middle who would otherwise downgrade the\r
// connection and read everything (Moxie Marlinspike's sslstrip, 2009). The catch is trust-on-first-use:\r
// the very first visit, before the header has ever been seen, is still in the clear. The preload list —\r
// a roster of HSTS hosts compiled INTO the browser — closes even that gap. We model the browser's HSTS\r
// store, the upgrade decision, and where a MITM can still strike. Reference: RFC 6797.\r
\r
export interface HstsEntry { expiry: number; includeSubDomains: boolean }\r
export type HstsStore = Record<string, HstsEntry>;\r
\r
export interface StsHeader { maxAge: number; includeSubDomains: boolean; preload: boolean }\r
\r
/** Parse a Strict-Transport-Security header value. Returns null if max-age is absent (the directive is\r
 *  then invalid per §6.1.1). Directive names are case-insensitive; max-age must be present exactly once. */\r
export function parseHeader(value: string): StsHeader | null {\r
  const parts = value.split(';').map((p) => p.trim()).filter(Boolean);\r
  let maxAge: number | null = null, includeSubDomains = false, preload = false;\r
  for (const p of parts) {\r
    const eq = p.indexOf('=');\r
    const name = (eq >= 0 ? p.slice(0, eq) : p).trim().toLowerCase();\r
    const raw = eq >= 0 ? p.slice(eq + 1).trim().replace(/^"|"$/g, '') : '';\r
    if (name === 'max-age') { const n = Number(raw); if (!Number.isFinite(n) || n < 0 || raw === '') return null; maxAge = Math.floor(n); }\r
    else if (name === 'includesubdomains') includeSubDomains = true;\r
    else if (name === 'preload') preload = true;\r
  }\r
  if (maxAge === null) return null;\r
  return { maxAge, includeSubDomains, preload };\r
}\r
\r
const parents = (host: string): string[] => {\r
  const out: string[] = [];\r
  const labels = host.split('.');\r
  for (let i = 1; i < labels.length - 1; i++) out.push(labels.slice(i).join('.'));\r
  return out; // proper superdomains only (exclude the host itself and the bare TLD)\r
};\r
\r
/** Is \`host\` an HSTS host right now — via the preload list, an exact unexpired entry, or a superdomain\r
 *  entry carrying includeSubDomains? (RFC 6797 §8.2–§8.3.) */\r
export function isHsts(store: HstsStore, preload: Set<string>, host: string, now: number): boolean {\r
  if (preload.has(host)) return true;\r
  const e = store[host];\r
  if (e && e.expiry > now) return true;\r
  for (const sup of parents(host)) {\r
    if (preload.has(sup)) return true;\r
    const pe = store[sup];\r
    if (pe && pe.expiry > now && pe.includeSubDomains) return true;\r
  }\r
  return false;\r
}\r
\r
/** Record a received STS header. Per §8.1, a header received over an INSECURE transport MUST be ignored.\r
 *  max-age=0 deletes the entry (§6.1.1). Returns a new store. */\r
export function record(store: HstsStore, host: string, header: StsHeader, secure: boolean, now: number): HstsStore {\r
  if (!secure) return store; // never trust HSTS asserted over plaintext\r
  const next = { ...store };\r
  if (header.maxAge === 0) delete next[host];\r
  else next[host] = { expiry: now + header.maxAge, includeSubDomains: header.includeSubDomains };\r
  return next;\r
}\r
\r
export interface NavResult { finalScheme: 'http' | 'https'; upgraded: boolean; intercepted: boolean; reason: string }\r
\r
/** Decide what the browser does with a navigation to host over the requested scheme, with a MITM possibly\r
 *  on the wire. If the host is an HSTS host, the scheme is upgraded to https before any request — the MITM\r
 *  is locked out. Otherwise a plaintext http request is exposed to stripping. */\r
export function navigate(scheme: 'http' | 'https', host: string, store: HstsStore, preload: Set<string>, now: number, mitm: boolean): NavResult {\r
  const protectedHost = isHsts(store, preload, host, now);\r
  if (scheme === 'http' && protectedHost)\r
    return { finalScheme: 'https', upgraded: true, intercepted: false, reason: preload.has(host) ? 'preloaded — upgraded to https in-browser, never touched the wire as http' : 'known HSTS host — upgraded to https before sending' };\r
  if (scheme === 'https')\r
    return { finalScheme: 'https', upgraded: false, intercepted: false, reason: 'already https — encrypted end to end' };\r
  // plaintext http, no HSTS protection yet\r
  if (mitm)\r
    return { finalScheme: 'http', upgraded: false, intercepted: true, reason: 'plaintext + no HSTS yet → SSL-stripped: the MITM reads and rewrites everything' };\r
  return { finalScheme: 'http', upgraded: false, intercepted: false, reason: 'plaintext http — would be vulnerable to a MITM (trust-on-first-use gap)' };\r
}\r
`;export{e as default};