var e=`// URL anatomy — parse a URI into its RFC 3986 components and explain each one.\r
// The grammar: scheme://[userinfo@]host[:port][/path][?query][#fragment]. We keep\r
// the raw substring AND the percent-decoded value of each component, flag a default\r
// port, and detect an IDN/punycode host. Pure regex+split parsing (the RFC 3986\r
// Appendix B regex, refined), tested against concrete examples.\r
import { percentEncode } from './encoding2';\r
\r
const DEFAULT_PORTS: Record<string, number> = { http: 80, https: 443, ftp: 21, ssh: 22, ws: 80, wss: 443 };\r
\r
export interface QueryParam { key: string; value: string; rawKey: string; rawValue: string }\r
export interface UrlParts {\r
  ok: boolean;\r
  error?: string;\r
  scheme: string;\r
  userinfo: string; // raw, e.g. user:pass\r
  user: string;\r
  password: string;\r
  host: string;\r
  isPunycode: boolean;\r
  port: string; // explicit port as written ('' if none)\r
  effectivePort: number | null; // explicit, or the scheme default\r
  isDefaultPort: boolean;\r
  path: string;\r
  pathDecoded: string;\r
  query: string; // raw query string without '?'\r
  params: QueryParam[];\r
  fragment: string;\r
  fragmentDecoded: string;\r
}\r
\r
/** Percent-decode a component (form-decoding turns '+' into space in query values). */\r
export function pctDecode(s: string, plusAsSpace = false): string {\r
  try {\r
    return decodeURIComponent(plusAsSpace ? s.replace(/\\+/g, ' ') : s);\r
  } catch {\r
    return s; // malformed % escapes: show as-is rather than throw\r
  }\r
}\r
\r
// RFC 3986 Appendix B regex, with the authority split out further below.\r
const URL_RE = /^(?:([a-zA-Z][a-zA-Z0-9+.-]*):)?(?:\\/\\/([^/?#]*))?([^?#]*)(?:\\?([^#]*))?(?:#(.*))?$/;\r
\r
export function parseUrl(input: string): UrlParts {\r
  const t = input.trim();\r
  const m = URL_RE.exec(t);\r
  const empty: UrlParts = {\r
    ok: false, scheme: '', userinfo: '', user: '', password: '', host: '', isPunycode: false,\r
    port: '', effectivePort: null, isDefaultPort: false, path: '', pathDecoded: '', query: '',\r
    params: [], fragment: '', fragmentDecoded: '',\r
  };\r
  if (!m) return { ...empty, error: 'Could not parse as a URL.' };\r
\r
  const scheme = (m[1] ?? '').toLowerCase();\r
  const authority = m[2] ?? '';\r
  const path = m[3] ?? '';\r
  const query = m[4] ?? '';\r
  const fragment = m[5] ?? '';\r
  if (!scheme && !authority) return { ...empty, error: 'No scheme or host — enter something like https://example.com/path.' };\r
\r
  // authority = [userinfo@]host[:port]\r
  let userinfo = '', hostport = authority;\r
  const at = authority.lastIndexOf('@');\r
  if (at >= 0) { userinfo = authority.slice(0, at); hostport = authority.slice(at + 1); }\r
  // split host:port (avoid colons inside an IPv6 literal [::1])\r
  let host = hostport, port = '';\r
  if (hostport.startsWith('[')) {\r
    const close = hostport.indexOf(']');\r
    host = hostport.slice(0, close + 1);\r
    if (hostport[close + 1] === ':') port = hostport.slice(close + 2);\r
  } else {\r
    const c = hostport.lastIndexOf(':');\r
    if (c >= 0) { host = hostport.slice(0, c); port = hostport.slice(c + 1); }\r
  }\r
  const [user, password] = userinfo.includes(':') ? [userinfo.slice(0, userinfo.indexOf(':')), userinfo.slice(userinfo.indexOf(':') + 1)] : [userinfo, ''];\r
\r
  const explicitPort = port !== '' ? Number(port) : null;\r
  const defaultPort = DEFAULT_PORTS[scheme] ?? null;\r
  const effectivePort = explicitPort ?? defaultPort;\r
  const isDefaultPort = explicitPort !== null && defaultPort !== null && explicitPort === defaultPort;\r
\r
  const params: QueryParam[] = query\r
    ? query.split('&').filter(Boolean).map((kv) => {\r
        const eq = kv.indexOf('=');\r
        const rawKey = eq >= 0 ? kv.slice(0, eq) : kv;\r
        const rawValue = eq >= 0 ? kv.slice(eq + 1) : '';\r
        return { rawKey, rawValue, key: pctDecode(rawKey, true), value: pctDecode(rawValue, true) };\r
      })\r
    : [];\r
\r
  return {\r
    ok: true, scheme, userinfo, user: pctDecode(user), password: pctDecode(password), host,\r
    isPunycode: /(^|\\.)xn--/i.test(host),\r
    port, effectivePort, isDefaultPort,\r
    path, pathDecoded: pctDecode(path), query, params,\r
    fragment, fragmentDecoded: pctDecode(fragment),\r
  };\r
}\r
\r
/** Round-trip helper used by the UI: re-encode a decoded value for display contrast. */\r
export const reEncode = (s: string): string => percentEncode(s);\r
`;export{e as default};