var e=`// WebAuthn / FIDO2 passkeys (W3C WebAuthn). Passwordless login by public-key signature.\r
// Registration: the authenticator (your phone/security key) generates a keypair bound to\r
// this site and gives the server the PUBLIC key — the private key never leaves the device.\r
// Authentication: the server sends a random challenge; the authenticator signs the\r
// challenge together with the ORIGIN it is actually talking to, and the server verifies\r
// with the stored public key. The origin binding is what makes passkeys phishing-proof:\r
// on a look-alike site the authenticator signs the attacker's origin, so the real server's\r
// check fails even though the signature is valid. Real signatures via the toy EdDSA;\r
// tested.\r
import { sign, verify, publicKey } from './eddsa';\r
import { sha256 } from './sha256';\r
import { type Pt } from './ecc';\r
\r
/** Hash the signed payload (challenge ‖ origin) to the integer the toy signer takes. */\r
function payload(challenge: string, origin: string): number {\r
  const d = sha256(new TextEncoder().encode(\`\${challenge}|\${origin}\`));\r
  return ((d[0] << 16) | (d[1] << 8) | d[2]) >>> 0;\r
}\r
\r
export interface Credential { publicKey: Pt; credentialId: string; rpId: string }\r
\r
/** Registration: the device keeps \`secret\`, the server stores the public key. */\r
export function register(secret: number, rpId: string): Credential {\r
  return { publicKey: publicKey(secret), credentialId: 'cred-' + rpId, rpId };\r
}\r
\r
export interface Assertion { signature: { R: Pt; s: number }; signedOrigin: string }\r
\r
/** The authenticator signs (challenge ‖ the origin it is actually visiting). */\r
export function authenticate(secret: number, challenge: string, actualOrigin: string): Assertion {\r
  const sig = sign(secret, payload(challenge, actualOrigin));\r
  return { signature: { R: sig.R, s: sig.s }, signedOrigin: actualOrigin };\r
}\r
\r
export interface Verdict { originOk: boolean; signatureOk: boolean; accepted: boolean; reason: string }\r
\r
/** The server accepts only if the signed origin is its own AND the signature verifies. */\r
export function verifyAssertion(cred: Credential, challenge: string, expectedOrigin: string, a: Assertion): Verdict {\r
  const originOk = a.signedOrigin === expectedOrigin;\r
  const signatureOk = verify(cred.publicKey, payload(challenge, a.signedOrigin), a.signature);\r
  const accepted = originOk && signatureOk;\r
  return {\r
    originOk, signatureOk, accepted,\r
    reason: !signatureOk ? 'signature does not verify (wrong key or tampered challenge)'\r
      : !originOk ? \`signed origin "\${a.signedOrigin}" ≠ expected "\${expectedOrigin}" — phishing blocked\`\r
      : 'origin matches and signature verifies — authenticated',\r
  };\r
}\r
`;export{e as default};