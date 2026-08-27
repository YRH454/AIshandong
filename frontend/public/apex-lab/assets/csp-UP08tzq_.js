var e=`// Content-Security-Policy (W3C CSP). Even if an attacker injects markup, CSP can stop it\r
// from running by telling the browser which sources are allowed for each resource type.\r
// A policy is a set of directives (script-src, style-src, img-src, …, default-src as the\r
// fallback); each lists allowed sources: 'self', a host allowlist, 'unsafe-inline',\r
// 'unsafe-eval', a 'nonce-…', or 'none'. The browser blocks anything not permitted — so\r
// inline <script> is refused unless you explicitly allow it, which is why CSP is the\r
// defense-in-depth layer behind output-escaping for XSS. Pure policy engine, tested.\r
\r
export type Policy = Map<string, string[]>;\r
\r
/** Parse a policy header like "default-src 'self'; script-src 'self' cdn.example.com". */\r
export function parsePolicy(text: string): Policy {\r
  const p: Policy = new Map();\r
  for (const part of text.split(';')) {\r
    const toks = part.trim().split(/\\s+/).filter(Boolean);\r
    if (toks.length) p.set(toks[0].toLowerCase(), toks.slice(1));\r
  }\r
  return p;\r
}\r
\r
export type ResType = 'script' | 'style' | 'img' | 'connect' | 'font';\r
export interface Load { type: ResType; kind: 'inline' | 'eval' | 'url'; url?: string; nonce?: string }\r
\r
const DIRECTIVE: Record<ResType, string> = {\r
  script: 'script-src', style: 'style-src', img: 'img-src', connect: 'connect-src', font: 'font-src',\r
};\r
\r
const host = (url: string) => url.replace(/^\\w+:\\/\\//, '').split('/')[0].toLowerCase();\r
\r
/** Does an allowlist source token match this URL (given the page's own host for 'self')? */\r
function hostMatches(source: string, url: string, pageHost: string): boolean {\r
  if (source === '*') return true;\r
  if (source === "'self'") return host(url) === pageHost;\r
  if (/^https?:$/.test(source)) return url.startsWith(source); // scheme-source\r
  const s = source.replace(/^\\w+:\\/\\//, '').replace(/\\/.*$/, '').toLowerCase();\r
  const h = host(url);\r
  if (s.startsWith('*.')) return h === s.slice(2) || h.endsWith('.' + s.slice(2)); // *.example.com\r
  return h === s;\r
}\r
\r
export interface Decision { directive: string; allowed: boolean; reason: string }\r
\r
export function evaluate(policy: Policy, load: Load, pageHost: string): Decision {\r
  const want = DIRECTIVE[load.type];\r
  const used = policy.has(want) ? want : policy.has('default-src') ? 'default-src' : null;\r
  if (!used) return { directive: '(none)', allowed: true, reason: \`no \${want} or default-src — nothing restricts \${load.type}\` };\r
\r
  const sources = policy.get(used)!;\r
  if (sources.includes("'none'")) return { directive: used, allowed: false, reason: \`\${used} 'none' blocks all \${load.type}\` };\r
\r
  if (load.kind === 'inline') {\r
    if (load.nonce && sources.includes(\`'nonce-\${load.nonce}'\`)) return { directive: used, allowed: true, reason: \`inline allowed by matching nonce-\${load.nonce}\` };\r
    if (sources.includes("'unsafe-inline'")) return { directive: used, allowed: true, reason: \`\${used} permits 'unsafe-inline'\` };\r
    return { directive: used, allowed: false, reason: \`inline \${load.type} blocked — no 'unsafe-inline' or matching nonce\` };\r
  }\r
  if (load.kind === 'eval') {\r
    const ok = sources.includes("'unsafe-eval'");\r
    return { directive: used, allowed: ok, reason: ok ? \`\${used} permits 'unsafe-eval'\` : \`eval() blocked — no 'unsafe-eval'\` };\r
  }\r
  // url load\r
  const ok = sources.some((s) => hostMatches(s, load.url!, pageHost));\r
  return { directive: used, allowed: ok, reason: ok ? \`\${host(load.url!)} is on the \${used} allowlist\` : \`\${host(load.url!)} not allowed by \${used}\` };\r
}\r
`;export{e as default};