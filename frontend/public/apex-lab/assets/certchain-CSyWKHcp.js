var e=`// Certificate-chain (PKI) path validation — why your browser trusts a site's cert.\r
// A TLS server sends a chain: leaf → intermediate(s) → (root). Validation walks it:\r
// each cert must be signed by the next up, its issuer must equal that parent's\r
// subject, every signer must be a CA, all certs must be in date, the chain must end\r
// at a TRUSTED root anchor, and the leaf must be valid for the host you asked for.\r
// We return the FIRST failure (that's how real validators fail-fast). RFC 5280 §6.\r
//\r
// The signatures are REAL: each cert carries the subject's public key and an honest\r
// RSA signature (rsa.ts) by the issuer over the cert's to-be-signed bytes, hashed\r
// with the from-scratch SHA-256. Tamper any signed field, or forge the signature,\r
// and verifyCert fails for real — no boolean stand-in. (Teaching key sizes, no\r
// PKCS#1 padding; the verification math itself is genuine.)\r
import { modpow, rsaKeygen, gcd, type RsaKey } from './rsa';\r
import { sha256 } from './sha256';\r
\r
export interface PubKey { n: bigint; e: bigint }\r
\r
export interface Cert {\r
  subject: string; // distinguished name (simplified to a CN/label)\r
  issuer: string; // who signed it (== parent.subject for a good chain)\r
  notBefore: number; // epoch seconds\r
  notAfter: number;\r
  isCA: boolean; // basicConstraints CA:TRUE\r
  sans: string[]; // subjectAltName DNS names (leaf only, really)\r
  pubKey: PubKey; // the subject's public key\r
  signature: bigint; // the issuer's RSA signature over this cert's TBS\r
}\r
\r
// ---- real signatures over the certificate ----------------------------------\r
const isPrime = (n: bigint): boolean => {\r
  if (n < 2n) return false;\r
  for (let i = 2n; i * i <= n; i++) if (n % i === 0n) return false;\r
  return true;\r
};\r
const nextPrime = (n: bigint): bigint => { while (!isPrime(n)) n++; return n; };\r
\r
/** A deterministic teaching keypair seeded near \`seed\` (real primes, e=65537). */\r
export function genKey(seed: number): RsaKey {\r
  const p = nextPrime(BigInt(seed));\r
  const q = nextPrime(BigInt(Math.floor(seed * 1.7)));\r
  const phi = (p - 1n) * (q - 1n);\r
  const e = gcd(65537n, phi) === 1n ? 65537n : 17n;\r
  return rsaKeygen(p, q, e);\r
}\r
\r
/** Canonical to-be-signed bytes (everything except the signature itself). */\r
export function tbsBytes(c: Cert): Uint8Array {\r
  const s = [c.subject, c.issuer, c.notBefore, c.notAfter, c.isCA ? 1 : 0, c.sans.join(','), c.pubKey.n.toString(), c.pubKey.e.toString()].join('|');\r
  return new TextEncoder().encode(s);\r
}\r
\r
/** SHA-256 of the TBS, reduced into the signing modulus. */\r
function tbsHash(c: Cert, n: bigint): bigint {\r
  let x = 0n;\r
  for (const b of sha256(tbsBytes(c))) x = (x << 8n) | BigInt(b);\r
  return x % n;\r
}\r
\r
/** Build a cert and have \`issuer\` sign it (issuer === own key for a self-signed root). */\r
export function signed(fields: Omit<Cert, 'pubKey' | 'signature'>, subjectPub: PubKey, issuer: RsaKey): Cert {\r
  const cert: Cert = { ...fields, pubKey: subjectPub, signature: 0n };\r
  cert.signature = modpow(tbsHash(cert, issuer.n), issuer.d, issuer.n); // s = H(tbs)^d mod n\r
  return cert;\r
}\r
\r
/** Verify cert's signature under an issuer public key: s^e mod n == H(tbs). */\r
export function verifyCert(cert: Cert, issuerPub: PubKey): boolean {\r
  return modpow(cert.signature, issuerPub.e, issuerPub.n) === tbsHash(cert, issuerPub.n);\r
}\r
\r
export type FailKind =\r
  | 'ok' | 'empty' | 'expired' | 'not-yet-valid' | 'issuer-subject-mismatch'\r
  | 'bad-signature' | 'parent-not-ca' | 'untrusted-root' | 'host-mismatch';\r
\r
export interface LinkResult {\r
  cert: Cert;\r
  index: number;\r
  ok: boolean;\r
  failure?: FailKind;\r
  reason?: string;\r
}\r
\r
export interface ChainResult {\r
  valid: boolean;\r
  failAt: number | null; // index of the first failing cert (or null)\r
  failure: FailKind;\r
  reason: string;\r
  links: LinkResult[];\r
}\r
\r
/** Does a leaf cert cover \`host\` (exact, or a single-level wildcard *.example.com)? */\r
export function hostMatches(cert: Cert, host: string): boolean {\r
  const names = cert.sans.length ? cert.sans : [cert.subject];\r
  return names.some((n) => {\r
    if (n === host) return true;\r
    if (n.startsWith('*.')) {\r
      const suffix = n.slice(1); // '.example.com'\r
      const idx = host.indexOf('.');\r
      return idx > 0 && host.slice(idx) === suffix; // wildcard matches exactly one label\r
    }\r
    return false;\r
  });\r
}\r
\r
/**\r
 * Validate \`chain\` (ordered leaf→…→root-or-last) for \`host\` at time \`now\`, given a\r
 * set of trusted root subjects. Returns the first failure encountered.\r
 */\r
export function validateChain(chain: Cert[], host: string, now: number, trustedRoots: Set<string>): ChainResult {\r
  const links: LinkResult[] = chain.map((cert, index) => ({ cert, index, ok: true }));\r
  const fail = (i: number, failure: FailKind, reason: string): ChainResult => {\r
    links[i] = { ...links[i], ok: false, failure, reason };\r
    return { valid: false, failAt: i, failure, reason, links };\r
  };\r
\r
  if (chain.length === 0) return { valid: false, failAt: null, failure: 'empty', reason: 'No certificates presented.', links };\r
\r
  // 1. leaf must be valid for the requested host\r
  if (!hostMatches(chain[0], host)) {\r
    return fail(0, 'host-mismatch', \`The leaf certificate is not valid for \${host} (covers \${(chain[0].sans.length ? chain[0].sans : [chain[0].subject]).join(', ')}).\`);\r
  }\r
\r
  for (let i = 0; i < chain.length; i++) {\r
    const cert = chain[i];\r
    // 2. validity period\r
    if (now < cert.notBefore) return fail(i, 'not-yet-valid', \`“\${cert.subject}” is not valid until later — its notBefore is in the future.\`);\r
    if (now > cert.notAfter) return fail(i, 'expired', \`“\${cert.subject}” has expired (past its notAfter date).\`);\r
\r
    const parent = chain[i + 1];\r
    if (parent) {\r
      // 3. issuer/subject linkage\r
      if (cert.issuer !== parent.subject) return fail(i, 'issuer-subject-mismatch', \`“\${cert.subject}” claims issuer “\${cert.issuer}”, but the next cert in the chain is “\${parent.subject}” — the chain is broken.\`);\r
      // 4. the signature must verify under the parent's key (real RSA verify)\r
      if (!verifyCert(cert, parent.pubKey)) return fail(i, 'bad-signature', \`“\${cert.subject}”’s signature does not verify under “\${parent.subject}”’s key — forged or tampered.\`);\r
      // 5. the signer must be a CA\r
      if (!parent.isCA) return fail(i + 1, 'parent-not-ca', \`“\${parent.subject}” signed a certificate but is not a CA (basicConstraints CA:FALSE).\`);\r
    } else {\r
      // 6. top of the presented chain — it must chain to a trusted anchor.\r
      // Either this cert IS a trusted root, or it was issued by one we trust.\r
      const anchor = cert.issuer === cert.subject ? cert.subject : cert.issuer;\r
      if (!trustedRoots.has(cert.subject) && !trustedRoots.has(anchor)) {\r
        return fail(i, 'untrusted-root', \`The chain ends at “\${cert.subject}” (issued by “\${cert.issuer}”), which is not in the trusted root store.\`);\r
      }\r
    }\r
  }\r
\r
  return { valid: true, failAt: null, failure: 'ok', reason: \`Trusted: \${host} chains to a trusted root, every signature verifies, and all certs are in date.\`, links };\r
}\r
`;export{e as default};