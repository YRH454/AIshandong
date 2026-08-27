var e=`// Email authentication: SPF + DKIM + DMARC — the three records that decide whether a\r
// message claiming to be "from your bank" really is. SPF (RFC 7208) checks the sending\r
// server's IP against a DNS list of allowed senders. DKIM (RFC 6376) verifies a\r
// cryptographic signature over the message using a public key in DNS, so any tampering\r
// breaks it. DMARC (RFC 7489) ties them to the visible From: domain by requiring\r
// ALIGNMENT — SPF or DKIM must pass AND match the From domain — then applies the domain\r
// owner's policy (none / quarantine / reject). DKIM here is a real (toy-modulus) RSA\r
// signature over a real SHA-256 digest; tested.\r
import { rsaSign, rsaVerify, type RsaKey } from './rsa';\r
import { sha256 } from './sha256';\r
\r
// ── SPF ──\r
export interface SpfResult { pass: boolean; domain: string }\r
export function spfCheck(senderIp: string, fromDomain: string, allowedIps: string[]): SpfResult {\r
  return { pass: allowedIps.includes(senderIp), domain: fromDomain };\r
}\r
\r
// ── DKIM (real RSA over SHA-256 of the body, reduced to the toy modulus) ──\r
function bodyHash(body: string, n: bigint): bigint {\r
  const d = sha256(new TextEncoder().encode(body));\r
  let h = 0n;\r
  for (const b of d) h = (h << 8n) | BigInt(b);\r
  return h % n;\r
}\r
export const dkimSign = (body: string, key: RsaKey): bigint => rsaSign(bodyHash(body, key.n), key);\r
\r
export interface DkimResult { pass: boolean; domain: string }\r
export function dkimVerify(body: string, sig: bigint, key: RsaKey, signingDomain: string): DkimResult {\r
  return { pass: rsaVerify(sig, key) === bodyHash(body, key.n), domain: signingDomain };\r
}\r
\r
// ── DMARC ──\r
export type Policy = 'none' | 'quarantine' | 'reject';\r
export interface Dmarc {\r
  spfAligned: boolean;\r
  dkimAligned: boolean;\r
  pass: boolean;\r
  action: 'deliver' | 'quarantine' | 'reject';\r
  reason: string;\r
}\r
\r
/** DMARC: pass if SPF or DKIM both AUTHENTICATED and ALIGNED with the visible From domain. */\r
export function dmarc(fromDomain: string, spf: SpfResult, dkim: DkimResult, policy: Policy): Dmarc {\r
  const spfAligned = spf.pass && spf.domain === fromDomain;\r
  const dkimAligned = dkim.pass && dkim.domain === fromDomain;\r
  const pass = spfAligned || dkimAligned;\r
  let action: Dmarc['action'] = 'deliver';\r
  if (!pass) action = policy === 'reject' ? 'reject' : policy === 'quarantine' ? 'quarantine' : 'deliver';\r
  return {\r
    spfAligned, dkimAligned, pass, action,\r
    reason: pass\r
      ? \`authenticated and aligned via \${spfAligned ? 'SPF' : ''}\${spfAligned && dkimAligned ? ' + ' : ''}\${dkimAligned ? 'DKIM' : ''}\`\r
      : policy === 'none' ? 'DMARC fails, but policy p=none → still delivered (monitoring only)'\r
      : \`DMARC fails and p=\${policy} → \${action}\`,\r
  };\r
}\r
`;export{e as default};