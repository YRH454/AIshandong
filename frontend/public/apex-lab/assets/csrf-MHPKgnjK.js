var e=`// Cross-Site Request Forgery (CSRF). You're logged into bank.com (you hold its session cookie). You visit evil.com,\r
// whose page silently makes your browser POST to bank.com — "transfer $5000". The browser attaches cookies by\r
// DESTINATION, not by who initiated the request, so bank.com's cookie rides along and the bank sees an authenticated\r
// request it can't distinguish from a real one. The fixes: SameSite cookies (don't send the cookie on cross-site\r
// requests) and a CSRF token (a per-session secret the attacker can't read, thanks to the same-origin policy).\r
\r
export type SameSite = 'strict' | 'lax' | 'none';\r
export type Defenses = { sameSite: SameSite; csrfToken: boolean };\r
export type Verdict = { cookieSent: boolean; accepted: boolean; reason: string };\r
\r
// An attacker page triggers a cross-site state-changing POST to the bank. What happens?\r
export function forge(d: Defenses): Verdict {\r
  // Strict and Lax both withhold the session cookie on a cross-site POST (Lax only allows it on top-level GET\r
  // navigations); only SameSite=None sends it cross-site.\r
  const cookieSent = d.sameSite === 'none';\r
  if (!cookieSent) {\r
    return { cookieSent, accepted: false, reason: \`SameSite=\${d.sameSite}: the browser withholds the session cookie on a cross-site POST, so the bank sees an unauthenticated request and rejects it.\` };\r
  }\r
  if (d.csrfToken) {\r
    return { cookieSent, accepted: false, reason: 'The cookie rode along, but the bank requires a CSRF token — a secret in the page the attacker cannot read (the same-origin policy blocks it). The forged request has no valid token, so it is rejected.' };\r
  }\r
  return { cookieSent, accepted: true, reason: 'The cookie rode along and no token was required — the bank sees a fully authenticated request and executes the transfer. That is CSRF.' };\r
}\r
`;export{e as default};