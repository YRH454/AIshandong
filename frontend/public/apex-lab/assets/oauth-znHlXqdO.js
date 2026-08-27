var e=`// OAuth 2.0 Authorization Code flow with PKCE (RFC 6749 + RFC 7636). How an app gets\r
// permission to call an API on your behalf WITHOUT ever seeing your password. The app\r
// redirects you to the authorization server; you authenticate and consent there; it\r
// redirects back with a one-time code; the app trades that code (plus a secret it can\r
// prove it created) for an access token. Two defenses make it safe: \`state\` stops CSRF,\r
// and PKCE — code_challenge = BASE64URL(SHA-256(code_verifier)) — stops an attacker who\r
// steals the code from redeeming it. Pure model; PKCE is anchored to the RFC 7636 vector.\r
import { sha256 } from './sha256';\r
\r
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';\r
\r
/** base64url (no padding), the encoding PKCE and JWT use. */\r
export function base64url(bytes: Uint8Array): string {\r
  let out = '';\r
  for (let i = 0; i < bytes.length; i += 3) {\r
    const b0 = bytes[i], b1 = bytes[i + 1] ?? 0, b2 = bytes[i + 2] ?? 0;\r
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];\r
    if (i + 1 < bytes.length) out += B64[((b1 & 15) << 2) | (b2 >> 6)];\r
    if (i + 2 < bytes.length) out += B64[b2 & 63];\r
  }\r
  return out;\r
}\r
\r
/** PKCE S256 challenge from a verifier. */\r
export const codeChallenge = (verifier: string): string => base64url(sha256(new TextEncoder().encode(verifier)));\r
\r
export interface Params { clientId: string; redirectUri: string; scope: string; state: string; verifier: string }\r
export interface Tamper { wrongState?: boolean; attackerStealsCode?: boolean }\r
\r
export interface Step { actor: 'app' | 'browser' | 'authserver'; title: string; detail: string; ok: boolean }\r
export interface Flow { steps: Step[]; tokenIssued: boolean; reason: string }\r
\r
export function runFlow(p: Params, t: Tamper = {}): Flow {\r
  const challenge = codeChallenge(p.verifier);\r
  const steps: Step[] = [];\r
  const code = 'AUTHCODE_' + p.state.slice(0, 4);\r
  const returnedState = t.wrongState ? p.state + 'X' : p.state;\r
\r
  steps.push({ actor: 'app', title: '1 · Authorization request', ok: true,\r
    detail: \`redirect to /authorize?client_id=\${p.clientId}&redirect_uri=\${p.redirectUri}&scope=\${p.scope}&state=\${p.state}&code_challenge=\${challenge.slice(0, 12)}…&code_challenge_method=S256\` });\r
  steps.push({ actor: 'authserver', title: '2 · Authenticate & consent', ok: true,\r
    detail: \`the user logs in AT the authorization server and approves scope "\${p.scope}". The app never sees the password.\` });\r
  steps.push({ actor: 'browser', title: '3 · Redirect back with code', ok: true,\r
    detail: \`→ \${p.redirectUri}?code=\${code}&state=\${returnedState}\` });\r
\r
  // CSRF defense: the returned state must equal the one the app sent\r
  const stateOk = returnedState === p.state;\r
  steps.push({ actor: 'app', title: '4 · Verify state (CSRF check)', ok: stateOk,\r
    detail: stateOk ? \`state matches "\${p.state}" — this response belongs to our request\` : \`state "\${returnedState}" ≠ "\${p.state}" — possible CSRF, abort\` });\r
  if (!stateOk) return { steps, tokenIssued: false, reason: 'state mismatch — request rejected (CSRF protection)' };\r
\r
  // PKCE defense: redeemer must present the verifier whose SHA-256 equals the challenge\r
  const presentedVerifier = t.attackerStealsCode ? 'attacker-guess' : p.verifier;\r
  const pkceOk = codeChallenge(presentedVerifier) === challenge;\r
  steps.push({ actor: 'app', title: '5 · Exchange code at /token', ok: pkceOk,\r
    detail: t.attackerStealsCode\r
      ? 'an attacker who intercepted the code tries to redeem it — but must also send code_verifier'\r
      : \`POST /token  code=\${code}&code_verifier=\${p.verifier.slice(0, 10)}…\` });\r
  steps.push({ actor: 'authserver', title: '6 · Server checks PKCE', ok: pkceOk,\r
    detail: pkceOk ? 'SHA-256(code_verifier) == code_challenge ✓ — issue access_token (+ id_token for OIDC)'\r
      : 'SHA-256(verifier) ≠ stored challenge — the code is useless without the original verifier' });\r
  if (!pkceOk) return { steps, tokenIssued: false, reason: 'PKCE verification failed — stolen code cannot be redeemed' };\r
\r
  return { steps, tokenIssued: true, reason: 'access token issued — the app can now call the API as the user' };\r
}\r
`;export{e as default};