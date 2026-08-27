var e=`// Open redirect — the deceptively hard problem of validating a "where to go next" URL. Apps take a\r
// ?next=/dashboard parameter and redirect there after login; if an attacker can make it point OFF-site,\r
// they get a link that starts on your trusted domain but lands on theirs — gold for phishing, and a way to\r
// steal OAuth tokens when redirect_uri is sloppily checked. The trap is that browsers parse URLs far more\r
// liberally than a naive check expects: backslashes become slashes, an @ hides the real host, a leading\r
// // is scheme-relative, and tabs/newlines are stripped mid-string. We model the browser's effective-host\r
// resolution and the same-origin/allowlist decision. References: OWASP "Unvalidated Redirects and\r
// Forwards"; the WHATWG URL parsing rules browsers follow.\r
\r
export type Kind = 'same-origin' | 'allowlisted' | 'external' | 'invalid';\r
export interface Verdict { input: string; effectiveHost: string | null; kind: Kind; safe: boolean; reason: string; trick?: string }\r
\r
/** Resolve the host a browser would actually navigate to for \`target\` from a page on \`originHost\`,\r
 *  mimicking the liberal normalization real browsers apply (backslash→slash, strip tab/newline/leading\r
 *  control chars, scheme-relative //, userinfo @). Returns null for a same-origin path. */\r
function effectiveHost(target: string): { host: string | null; offsite: boolean; trick?: string } {\r
  // Browsers strip leading C0 controls/space, and remove ASCII tab/newline ANYWHERE in the URL.\r
  let s = target.replace(/^[\\x00-\\x20]+/, '').replace(/[\\t\\n\\r]/g, '');\r
  const hadBackslash = /\\\\/.test(s);\r
  s = s.replace(/\\\\/g, '/'); // browsers treat backslashes as forward slashes in the scheme/authority\r
\r
  let authority: string | null = null;\r
  let trick: string | undefined;\r
  const scheme = s.match(/^([a-zA-Z][a-zA-Z0-9+.\\-]*):\\/\\//);\r
  const schemeOnly = s.match(/^([a-zA-Z][a-zA-Z0-9+.\\-]*):(?!\\/\\/)/); // a scheme: NOT followed by //\r
  if (scheme) {\r
    // Special schemes (http/https/…) enter WHATWG's "ignore slashes" state: ALL leading slashes after the\r
    // scheme are skipped, so https:///evil.com and https:////evil.com put evil.com in the HOST, not the path.\r
    authority = s.slice(scheme[0].length).replace(/^\\/+/, '');\r
  } else if (schemeOnly) {\r
    // A bare "scheme:rest" (no //). javascript:/data:/etc. are code/inline schemes; a different special\r
    // scheme like http: from an https page navigates OFF-SITE; even "https:evil.com" is ambiguous. The only\r
    // safe verdict for a redirect validator is to FAIL CLOSED — never call these same-origin.\r
    const sch = schemeOnly[1].toLowerCase();\r
    const rest = s.slice(schemeOnly[0].length).replace(/^\\/+/, '');\r
    if (['javascript', 'data', 'vbscript', 'file', 'blob'].includes(sch)) {\r
      return { host: \`\${sch}: scheme\`, offsite: true, trick: \`dangerous \${sch}: scheme (not a navigation to a host)\` };\r
    }\r
    authority = rest;\r
    trick = \`scheme without // (\${sch}:) — treated as off-site\`;\r
  } else if (s.startsWith('//')) {\r
    authority = s.slice(2).replace(/^\\/+/, ''); // scheme-relative (extra slashes ignored) → goes off-origin\r
    trick = hadBackslash ? 'backslash → scheme-relative //' : 'scheme-relative //';\r
  } else {\r
    // a path (/foo) or a bare relative ref → stays same-origin\r
    if (hadBackslash && /^\\/+/.test(target.replace(/^[\\x00-\\x20]+/, ''))) trick = 'backslash path';\r
    return { host: null, offsite: false, trick };\r
  }\r
\r
  // authority ends at the first / ? or #\r
  const auth = authority.split(/[/?#]/)[0];\r
  // userinfo before an @ is NOT the host — the real host is after the LAST @\r
  let hostPart = auth;\r
  if (auth.includes('@')) { hostPart = auth.slice(auth.lastIndexOf('@') + 1); trick = trick ?? 'userinfo @ before real host'; }\r
  const host = hostPart.split(':')[0].toLowerCase(); // strip port\r
  if (!host) return { host: null, offsite: false, trick }; // e.g. "https:///path" → same-origin-ish\r
  return { host, offsite: true, trick };\r
}\r
\r
/** Classify a redirect target relative to \`originHost\`, given an allowlist of acceptable external hosts. */\r
export function classify(target: string, originHost: string, allowlist: string[] = []): Verdict {\r
  if (target.trim() === '') return { input: target, effectiveHost: null, kind: 'invalid', safe: false, reason: 'empty target' };\r
  const { host, offsite, trick } = effectiveHost(target);\r
  const origin = originHost.toLowerCase();\r
  const allow = new Set(allowlist.map((h) => h.toLowerCase()));\r
\r
  if (!offsite || host === null) {\r
    return { input: target, effectiveHost: null, kind: 'same-origin', safe: true, reason: 'resolves to a path on the current origin', trick };\r
  }\r
  if (host === origin) {\r
    return { input: target, effectiveHost: host, kind: 'same-origin', safe: true, reason: 'absolute URL but same host as the origin', trick };\r
  }\r
  if (allow.has(host)) {\r
    return { input: target, effectiveHost: host, kind: 'allowlisted', safe: true, reason: \`host is on the redirect allowlist\`, trick };\r
  }\r
  return {\r
    input: target, effectiveHost: host, kind: 'external', safe: false,\r
    reason: trick ? \`escapes the origin via \${trick} → \${host}\` : \`redirects off-site to \${host}\`,\r
    trick,\r
  };\r
}\r
`;export{e as default};