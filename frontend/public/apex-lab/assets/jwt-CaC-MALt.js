var e=`// JSON Web Tokens (RFC 7519). A JWT is three base64url parts —\r
// header.payload.signature — that are SIGNED, not encrypted: anyone can read the\r
// claims, only the key holder can forge a valid signature. The notorious failure\r
// is \`alg:none\`, which tells a naive verifier to skip the check entirely. We\r
// decode honestly and flag that. Signature verification is real HMAC-SHA256.\r
\r
export function b64urlToBytes(s: string): Uint8Array {\r
  let t = s.replace(/-/g, '+').replace(/_/g, '/');\r
  while (t.length % 4) t += '=';\r
  const bin = atob(t);\r
  const out = new Uint8Array(bin.length);\r
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);\r
  return out;\r
}\r
\r
export function bytesToB64url(bytes: Uint8Array): string {\r
  let bin = '';\r
  for (const b of bytes) bin += String.fromCharCode(b);\r
  return btoa(bin).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');\r
}\r
\r
export interface JwtParsed {\r
  ok: boolean;\r
  error?: string;\r
  header: Record<string, unknown>;\r
  payload: Record<string, unknown>;\r
  signature: string; // the raw base64url signature segment\r
  signingInput: string; // header.payload — what the signature covers\r
  alg: string;\r
  warnings: string[];\r
}\r
\r
/** Decode (NOT verify) a JWT into its parts, flagging dangerous algorithms. */\r
export function decodeJwt(token: string): JwtParsed {\r
  const empty: JwtParsed = { ok: false, header: {}, payload: {}, signature: '', signingInput: '', alg: '', warnings: [] };\r
  const parts = token.trim().split('.');\r
  if (parts.length !== 3) return { ...empty, error: 'A JWT has exactly three dot-separated parts.' };\r
  try {\r
    const dec = new TextDecoder();\r
    const header = JSON.parse(dec.decode(b64urlToBytes(parts[0]))) as Record<string, unknown>;\r
    const payload = JSON.parse(dec.decode(b64urlToBytes(parts[1]))) as Record<string, unknown>;\r
    const alg = String(header.alg ?? '');\r
    const warnings: string[] = [];\r
    if (alg.toLowerCase() === 'none' || parts[2] === '') {\r
      warnings.push('alg is "none" — the token is UNSIGNED. A verifier that honours this accepts forged tokens.');\r
    }\r
    if (alg.startsWith('HS') && 'kid' in header === false) {\r
      // informational only\r
    }\r
    return { ok: true, header, payload, signature: parts[2], signingInput: \`\${parts[0]}.\${parts[1]}\`, alg, warnings };\r
  } catch (e) {\r
    return { ...empty, error: e instanceof Error ? e.message : 'Could not parse the token.' };\r
  }\r
}\r
\r
/** Verify an HS256 JWT signature with a candidate secret (real HMAC-SHA256). */\r
export async function verifyHs256(token: string, secret: string): Promise<boolean> {\r
  const parts = token.trim().split('.');\r
  if (parts.length !== 3) return false;\r
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto unavailable.');\r
  const enc = new TextEncoder();\r
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);\r
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(\`\${parts[0]}.\${parts[1]}\`)));\r
  return bytesToB64url(sig) === parts[2];\r
}\r
\r
const b64urlJson = (o: unknown): string => bytesToB64url(new TextEncoder().encode(JSON.stringify(o)));\r
\r
/** Mint a real HS256 JWT (header.payload.signature) with a shared secret. */\r
export async function signHS256(header: object, payload: object, secret: string): Promise<string> {\r
  const signingInput = \`\${b64urlJson(header)}.\${b64urlJson(payload)}\`;\r
  const enc = new TextEncoder();\r
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);\r
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(signingInput)));\r
  return \`\${signingInput}.\${bytesToB64url(sig)}\`;\r
}\r
\r
export interface Verdict { valid: boolean; reason: string }\r
\r
/** Strict verifier: the SERVER fixes the algorithm; the token's header can't change it. The correct way. */\r
export async function verifyStrict(token: string, secret: string, expectedAlg = 'HS256'): Promise<Verdict> {\r
  const d = decodeJwt(token);\r
  if (!d.ok) return { valid: false, reason: d.error ?? 'malformed token' };\r
  if (d.alg !== expectedAlg) return { valid: false, reason: \`alg "\${d.alg}" ≠ server's "\${expectedAlg}" — rejected\` };\r
  return (await verifyHs256(token, secret))\r
    ? { valid: true, reason: 'signature valid' }\r
    : { valid: false, reason: 'signature mismatch' };\r
}\r
\r
/** Naive verifier: reads the algorithm from the attacker-controlled header, and honors alg=none. VULNERABLE. */\r
export async function verifyNaive(token: string, secret: string): Promise<Verdict> {\r
  const d = decodeJwt(token);\r
  if (!d.ok) return { valid: false, reason: d.error ?? 'malformed token' };\r
  if (d.alg.toLowerCase() === 'none') return { valid: true, reason: 'alg=none → accepted with NO signature check' };\r
  return (await verifyHs256(token, secret))\r
    ? { valid: true, reason: 'signature valid' }\r
    : { valid: false, reason: 'signature mismatch' };\r
}\r
\r
/** Forge an unsigned token: set alg=none, tamper the payload, drop the signature. */\r
export function forgeAlgNone(token: string, tamper: object): string {\r
  const d = decodeJwt(token);\r
  return \`\${b64urlJson({ alg: 'none', typ: 'JWT' })}.\${b64urlJson({ ...d.payload, ...tamper })}.\`;\r
}\r
`;export{e as default};