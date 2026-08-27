var e=`// The Same-Origin Policy and CORS (WHATWG Fetch standard). A browser lets a page read a\r
// response only from its OWN origin — scheme + host + port, all three — unless the other\r
// server opts in with Cross-Origin Resource Sharing headers. "Simple" requests go\r
// straight out and the browser hides the response unless Access-Control-Allow-Origin\r
// matches; anything else (PUT/DELETE, custom headers, JSON bodies) triggers a PREFLIGHT\r
// OPTIONS that asks permission first. Credentials (cookies) add a stricter rule: the\r
// allow-origin must be a specific origin, never "*". Pure decision logic, tested.\r
\r
export interface Origin { scheme: string; host: string; port: number }\r
const DEFAULT_PORT: Record<string, number> = { http: 80, https: 443 };\r
\r
export function parseOrigin(url: string): Origin {\r
  const m = url.match(/^(\\w+):\\/\\/([^/:]+)(?::(\\d+))?/);\r
  if (!m) throw new Error(\`bad url: \${url}\`);\r
  const scheme = m[1].toLowerCase();\r
  return { scheme, host: m[2].toLowerCase(), port: m[3] ? +m[3] : DEFAULT_PORT[scheme] ?? 0 };\r
}\r
\r
export const originStr = (o: Origin) =>\r
  \`\${o.scheme}://\${o.host}\${o.port === (DEFAULT_PORT[o.scheme] ?? -1) ? '' : ':' + o.port}\`;\r
\r
/** Same origin iff scheme, host AND port all match (default ports normalised). */\r
export function sameOrigin(a: Origin, b: Origin): boolean {\r
  return a.scheme === b.scheme && a.host === b.host && a.port === b.port;\r
}\r
\r
export interface Request { method: string; customHeaders: string[]; contentType: string; credentials: boolean }\r
export interface ServerCORS { allowOrigin: string; allowMethods: string[]; allowHeaders: string[]; allowCredentials: boolean }\r
\r
const SIMPLE_METHODS = ['GET', 'HEAD', 'POST'];\r
const SIMPLE_CONTENT = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain', ''];\r
\r
/** A "simple" request skips preflight: safe method, no custom headers, simple body type. */\r
export function isSimple(req: Request): boolean {\r
  return SIMPLE_METHODS.includes(req.method.toUpperCase())\r
    && req.customHeaders.length === 0\r
    && SIMPLE_CONTENT.includes(req.contentType.toLowerCase());\r
}\r
\r
export interface Check { ok: boolean; reason: string }\r
export interface Decision {\r
  sameOrigin: boolean;\r
  needsPreflight: boolean;\r
  preflight?: Check;\r
  actual: Check;\r
  readable: boolean;\r
}\r
\r
function originAllowed(server: ServerCORS, page: Origin, credentials: boolean): Check {\r
  const wildcard = server.allowOrigin === '*';\r
  if (credentials && wildcard)\r
    return { ok: false, reason: 'with credentials, Access-Control-Allow-Origin must be a specific origin, not "*"' };\r
  if (credentials && !server.allowCredentials)\r
    return { ok: false, reason: 'credentialed request but Access-Control-Allow-Credentials is not true' };\r
  if (wildcard) return { ok: true, reason: 'Access-Control-Allow-Origin: * accepts any origin' };\r
  const ok = server.allowOrigin.toLowerCase() === originStr(page).toLowerCase();\r
  return { ok, reason: ok ? \`Allow-Origin echoes \${originStr(page)}\` : \`Allow-Origin is \${server.allowOrigin}, not \${originStr(page)}\` };\r
}\r
\r
export function evaluate(pageUrl: string, targetUrl: string, req: Request, server: ServerCORS): Decision {\r
  const page = parseOrigin(pageUrl), target = parseOrigin(targetUrl);\r
  if (sameOrigin(page, target))\r
    return { sameOrigin: true, needsPreflight: false, actual: { ok: true, reason: 'same origin — the policy does not apply' }, readable: true };\r
\r
  const simple = isSimple(req);\r
  let preflight: Check | undefined;\r
  if (!simple) {\r
    // a "*" is NOT a wildcard when credentials are included — it matches the literal "*"\r
    // only (WHATWG Fetch), same rule already applied to the origin above\r
    const methodWild = !req.credentials && server.allowMethods.includes('*');\r
    const methodOk = methodWild || server.allowMethods.map((m) => m.toUpperCase()).includes(req.method.toUpperCase());\r
    const lowerAllowed = server.allowHeaders.map((h) => h.toLowerCase());\r
    const headerWild = !req.credentials && lowerAllowed.includes('*');\r
    const missing = req.customHeaders.filter((h) => !headerWild && !lowerAllowed.includes(h.toLowerCase()));\r
    const originCheck = originAllowed(server, page, req.credentials);\r
    if (!originCheck.ok) preflight = originCheck;\r
    else if (!methodOk) preflight = { ok: false, reason: \`method \${req.method} not in Access-Control-Allow-Methods\` };\r
    else if (missing.length) preflight = { ok: false, reason: \`header(s) \${missing.join(', ')} not in Access-Control-Allow-Headers\` };\r
    else preflight = { ok: true, reason: 'OPTIONS preflight approved method, headers, and origin' };\r
  }\r
\r
  if (preflight && !preflight.ok)\r
    return { sameOrigin: false, needsPreflight: true, preflight, actual: { ok: false, reason: 'blocked before the real request was sent' }, readable: false };\r
\r
  const actual = originAllowed(server, page, req.credentials);\r
  return { sameOrigin: false, needsPreflight: !simple, preflight, actual, readable: actual.ok };\r
}\r
`;export{e as default};