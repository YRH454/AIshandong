var e=`// HTTP cookies (RFC 6265) — Set-Cookie parsing and the matching rules that decide\r
// which cookies a browser attaches to a request. The headline truths: cookies are\r
// scoped by Domain (incl. subdomains) and Path (prefix), a Secure cookie only rides\r
// HTTPS, HttpOnly hides it from JavaScript (XSS defense), and SameSite controls\r
// whether it's sent on cross-site requests (CSRF defense). Pure rules, tested.\r
\r
export type SameSite = 'Strict' | 'Lax' | 'None';\r
export interface Cookie {\r
  name: string;\r
  value: string;\r
  domain: string; // host scope; a leading '.' / Domain attr allows subdomains\r
  hostOnly: boolean; // true when no Domain attribute → exact host only\r
  path: string;\r
  secure: boolean;\r
  httpOnly: boolean;\r
  sameSite: SameSite;\r
  expires: number | null; // epoch seconds; null = session cookie\r
}\r
\r
export interface SetCookieInput {\r
  header: string; // the raw Set-Cookie value\r
  requestHost: string; // host that set it (for default domain/path)\r
  requestPath: string;\r
  now: number; // current epoch seconds, for resolving Max-Age to an absolute time\r
}\r
\r
/** Parse a Set-Cookie header into a Cookie (RFC 6265 §5.2), filling defaults. */\r
export function parseSetCookie(input: SetCookieInput): Cookie | null {\r
  const parts = input.header.split(';').map((s) => s.trim());\r
  const first = parts[0];\r
  const eq = first.indexOf('=');\r
  if (eq < 0) return null;\r
  const name = first.slice(0, eq).trim();\r
  const value = first.slice(eq + 1).trim();\r
  if (!name) return null;\r
\r
  const attrs: Record<string, string> = {};\r
  for (const a of parts.slice(1)) {\r
    const i = a.indexOf('=');\r
    const k = (i < 0 ? a : a.slice(0, i)).trim().toLowerCase();\r
    attrs[k] = i < 0 ? '' : a.slice(i + 1).trim();\r
  }\r
\r
  const domainAttr = attrs['domain'];\r
  const hostOnly = !domainAttr;\r
  const domain = (domainAttr ? domainAttr.replace(/^\\./, '') : input.requestHost).toLowerCase();\r
  // default path = the directory of the request path (RFC 6265 §5.1.4)\r
  const path = attrs['path'] || defaultPath(input.requestPath);\r
\r
  let expires: number | null = null;\r
  if ('max-age' in attrs) {\r
    const ma = parseInt(attrs['max-age'], 10);\r
    expires = Number.isNaN(ma) ? null : input.now + ma; // Max-Age is relative to now\r
  } else if (attrs['expires']) {\r
    const t = Date.parse(attrs['expires']);\r
    if (!Number.isNaN(t)) expires = Math.floor(t / 1000);\r
  }\r
\r
  const ss = (attrs['samesite'] || '').toLowerCase();\r
  const sameSite: SameSite = ss === 'strict' ? 'Strict' : ss === 'none' ? 'None' : 'Lax'; // Lax is the modern default\r
\r
  return {\r
    name, value, domain, hostOnly, path,\r
    secure: 'secure' in attrs,\r
    httpOnly: 'httponly' in attrs,\r
    sameSite,\r
    expires,\r
  };\r
}\r
\r
/** RFC 6265 §5.1.4 default-path: everything up to the last '/'. */\r
export function defaultPath(p: string): string {\r
  if (!p.startsWith('/')) return '/';\r
  const i = p.lastIndexOf('/');\r
  return i <= 0 ? '/' : p.slice(0, i);\r
}\r
\r
/** Domain-match (RFC 6265 §5.1.3): exact, or cookie domain is a parent of the host. */\r
export function domainMatch(host: string, cookie: Cookie): boolean {\r
  host = host.toLowerCase();\r
  if (host === cookie.domain) return true;\r
  if (cookie.hostOnly) return false; // host-only cookies never match subdomains\r
  return host.endsWith('.' + cookie.domain);\r
}\r
\r
/** Path-match (RFC 6265 §5.1.4): request path is the cookie path or below it. */\r
export function pathMatch(reqPath: string, cookiePath: string): boolean {\r
  if (reqPath === cookiePath) return true;\r
  if (!reqPath.startsWith(cookiePath)) return false;\r
  return cookiePath.endsWith('/') || reqPath[cookiePath.length] === '/';\r
}\r
\r
export interface Request {\r
  host: string;\r
  path: string;\r
  https: boolean;\r
  crossSite: boolean; // is this a cross-site request (e.g. a third-party/forged one)?\r
  topLevelNav: boolean; // a top-level navigation (matters for SameSite=Lax)\r
  now: number; // current epoch seconds\r
}\r
\r
export interface MatchResult {\r
  cookie: Cookie;\r
  sent: boolean;\r
  reason: string;\r
}\r
\r
/** Decide, per cookie, whether it is attached to the request and why/why not. */\r
export function evaluate(jar: Cookie[], req: Request): MatchResult[] {\r
  return jar.map((c) => {\r
    if (c.expires !== null && c.expires <= req.now) return { cookie: c, sent: false, reason: 'expired — removed from the jar' };\r
    if (!domainMatch(req.host, c)) return { cookie: c, sent: false, reason: \`domain mismatch (cookie scope \${c.hostOnly ? c.domain + ' only' : '.' + c.domain})\` };\r
    if (!pathMatch(req.path, c.path)) return { cookie: c, sent: false, reason: \`path mismatch (cookie path \${c.path})\` };\r
    if (c.secure && !req.https) return { cookie: c, sent: false, reason: 'Secure cookie withheld over plain HTTP' };\r
    if (req.crossSite) {\r
      if (c.sameSite === 'Strict') return { cookie: c, sent: false, reason: 'SameSite=Strict blocks all cross-site sends (CSRF defense)' };\r
      if (c.sameSite === 'Lax' && !req.topLevelNav) return { cookie: c, sent: false, reason: 'SameSite=Lax blocks cross-site subrequests (only top-level GET navigations pass)' };\r
      if (c.sameSite === 'None' && !c.secure) return { cookie: c, sent: false, reason: 'SameSite=None requires Secure — rejected' };\r
    }\r
    return { cookie: c, sent: true, reason: 'all checks pass — attached to the request' };\r
  });\r
}\r
`;export{e as default};