var e=`// SSRF (Server-Side Request Forgery) — when an app fetches a URL the user controls, and the attacker\r
// points it INWARD. Your server sits inside a trusted network with no firewall between it and internal\r
// services, so "fetch this image URL for me" becomes "fetch http://169.254.169.254/…" — the cloud\r
// metadata endpoint that hands back the instance's IAM credentials (the heart of the 2019 Capital One\r
// breach), or http://localhost:6379 to talk to an unauthenticated internal Redis. The naive defense — a\r
// STRING denylist of "localhost"/"127.0.0.1"/private ranges — is defeated because the OS resolver accepts\r
// the same address written many ways (decimal, hex, octal, short forms, IPv6-mapped): the denylist never\r
// sees "127.0.0.1", but connect() still goes there. This models that faithfully: classify() decodes the host\r
// the way inet_aton does (ground truth), a naive filter matches literal strings only, and a robust filter\r
// validates the RESOLVED ip. Reference: OWASP SSRF; the AWS IMDS / Capital One incident.\r
\r
export type Category = 'public' | 'loopback' | 'private' | 'metadata' | 'link-local';\r
export type Protection = 'off' | 'naive' | 'resolve';\r
export interface SsrfResult {\r
  host: string; category: Category; internal: boolean; blocked: boolean; fetched: boolean;\r
  reached: boolean; bypassed: boolean; danger: string; note?: string;\r
}\r
\r
// Parse one dotted part the way inet_aton does: 0x → hex, leading 0 → octal, else decimal.\r
function parsePart(p: string): number | null {\r
  let v: number;\r
  if (/^0x[0-9a-f]+$/i.test(p)) v = parseInt(p.slice(2), 16);\r
  else if (/^0[0-7]+$/.test(p)) v = parseInt(p, 8);\r
  else if (/^[1-9]\\d*$/.test(p) || p === '0') v = parseInt(p, 10);\r
  else return null;\r
  return Number.isFinite(v) && v >= 0 ? v : null;\r
}\r
\r
// inet_aton semantics — 1 to 4 parts, the last absorbing the remaining low bytes. This is exactly WHY\r
// http://2130706433/, http://0x7f000001/, http://0177.0.0.1/ and http://127.1/ all reach 127.0.0.1:\r
// the resolver accepts them, so a denylist that only matched the literal "127.0.0.1" is bypassed.\r
export function inetAton(host: string): number[] | null {\r
  const parts = host.split('.');\r
  if (parts.length === 0 || parts.length > 4 || parts.some((p) => p === '')) return null;\r
  const n = parts.map(parsePart);\r
  if (n.some((x) => x === null)) return null;\r
  const N = n as number[];\r
  let value: number;\r
  if (N.length === 1) { if (N[0] > 0xffffffff) return null; value = N[0]; }\r
  else if (N.length === 2) { if (N[0] > 255 || N[1] > 0xffffff) return null; value = N[0] * 2 ** 24 + N[1]; }\r
  else if (N.length === 3) { if (N[0] > 255 || N[1] > 255 || N[2] > 0xffff) return null; value = N[0] * 2 ** 24 + N[1] * 2 ** 16 + N[2]; }\r
  else { if (N.some((x) => x > 255)) return null; value = N[0] * 2 ** 24 + N[1] * 2 ** 16 + N[2] * 256 + N[3]; }\r
  value >>>= 0;\r
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];\r
}\r
\r
const catOf = (o: number[]): Category => {\r
  if (o[0] === 169 && o[1] === 254 && o[2] === 169 && o[3] === 254) return 'metadata';\r
  if (o[0] === 127 || (o[0] === 0 && o[1] === 0 && o[2] === 0 && o[3] === 0)) return 'loopback';\r
  if (o[0] === 169 && o[1] === 254) return 'link-local';\r
  if (o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168)) return 'private';\r
  return 'public';\r
};\r
\r
// Extract the authority host AS THE ATTACKER WROTE IT — deliberately NOT via new URL(), because the WHATWG URL\r
// parser normalizes numeric IPs to dotted-decimal (it runs the IPv4 parser), which would pre-defeat the bypass a\r
// naive string denylist is vulnerable to. The denylist sees this raw string; the resolver decodes it.\r
function rawHost(url: string): string {\r
  let s = url.trim();\r
  const i = s.indexOf('://'); if (i >= 0) s = s.slice(i + 3);\r
  s = s.split(/[/?#]/)[0];                       // authority only\r
  s = s.split('@').pop() ?? s;                   // drop any userinfo\r
  if (s.startsWith('[')) { const j = s.indexOf(']'); return (j > 0 ? s.slice(1, j) : s.slice(1)).toLowerCase(); }\r
  return s.split(':')[0].toLowerCase();          // drop the port\r
}\r
\r
/** Classify the URL's host into where it ACTUALLY points, decoding obfuscated IP forms (the ground truth). */\r
export function classify(url: string): { host: string; category: Category; note?: string } {\r
  let host = rawHost(url);\r
\r
  if (host.includes(':')) { // IPv6 loopback, or IPv4-mapped IPv6 (::ffff:a.b.c.d)\r
    if (host === '::1' || host === '::') return { host, category: 'loopback' };\r
    const m = host.match(/^::ffff:(.+)$/i);\r
    if (m) host = m[1]; else return { host, category: 'public' };\r
  }\r
  const o = inetAton(host);\r
  if (o) { const canon = o.join('.'); return { host, category: catOf(o), note: canon !== host ? \`resolves to \${canon}\` : undefined }; }\r
  if (host === 'localhost') return { host, category: 'loopback' };\r
  return { host, category: 'public' };\r
}\r
\r
// A naive filter: string-match the literal host against known-internal patterns. It never runs the resolver,\r
// so any non-literal encoding (decimal/hex/octal single or short form) sails straight through.\r
function naiveDenylisted(host: string): boolean {\r
  return host === 'localhost' || host === '::1' || host === '169.254.169.254'\r
    || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')\r
    || /^172\\.(1[6-9]|2\\d|3[01])\\./.test(host) || host.startsWith('169.254.');\r
}\r
\r
const DANGER: Record<Category, string> = {\r
  metadata: 'reads cloud IAM credentials from the instance metadata service — full account takeover',\r
  loopback: 'reaches services bound to localhost that trust anyone who can connect (Redis, admin panels, debug ports)',\r
  private: 'reaches internal hosts behind the firewall — databases, dashboards, other services',\r
  'link-local': 'reaches link-local addresses, including metadata on some clouds',\r
  public: 'an ordinary external request — the intended use',\r
};\r
\r
/** Decide the outcome under a protection mode: none, a naive string denylist, or resolve-then-check. */\r
export function evaluate(url: string, protection: Protection): SsrfResult {\r
  const { host, category, note } = classify(url);\r
  const internal = category !== 'public';\r
  const naiveHit = naiveDenylisted(host);\r
  const blocked = protection === 'resolve' ? internal : protection === 'naive' ? naiveHit : false;\r
  const reached = !blocked && internal;                         // the request landed on an internal target = SSRF\r
  const bypassed = protection === 'naive' && internal && !naiveHit; // the denylist was on, the encoding slipped past it\r
  return { host, category, internal, blocked, fetched: !blocked, reached, bypassed, danger: DANGER[category], note };\r
}\r
`;export{e as default};