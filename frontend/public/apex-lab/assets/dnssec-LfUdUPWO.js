var e=`// DNSSEC chain of trust (RFC 4033–4035). A resolver trusts one key — the root's — and\r
// from it validates a signed delegation chain down to the answer. Two kinds of link\r
// alternate: a SIGNATURE link (an RRSIG over an RRset verifies under the zone's DNSKEY)\r
// and a DELEGATION link (the parent zone holds a DS record = a hash of the child's\r
// DNSKEY, and that DS is itself signed). If every link holds from the trust anchor to\r
// the leaf, the answer is "secure"; break any one and validation fails ("bogus" →\r
// SERVFAIL). The DS digests use real SHA-256, and the RRSIGs are real (toy-modulus) RSA\r
// signatures — sign with d, verify with e — so the chain is honest math, not theatre.\r
import { rsaKeygen, rsaSign, rsaVerify, type RsaKey } from './rsa';\r
import { sha256, hex } from './sha256';\r
\r
export interface Zone { name: string; key: RsaKey }\r
\r
const enc = (s: string) => new TextEncoder().encode(s);\r
\r
/** A DS record is a digest of the child zone's DNSKEY (real SHA-256). */\r
export function digestKey(key: RsaKey): string {\r
  return hex(sha256(enc(\`DNSKEY \${key.n} \${key.e}\`)));\r
}\r
\r
/** Hash an RRset to an integer below the signing modulus (toy stand-in for the real\r
 *  full-width RSA/SHA signature; the avalanche still comes from real SHA-256). */\r
export function hashRRset(data: string, n: bigint): bigint {\r
  const d = sha256(enc(data));\r
  let h = 0n;\r
  for (const b of d) h = (h << 8n) | BigInt(b);\r
  return h % n;\r
}\r
\r
export const signRRset = (data: string, key: RsaKey): bigint => rsaSign(hashRRset(data, key.n), key);\r
export const verifyRRset = (data: string, sig: bigint, key: RsaKey): boolean =>\r
  rsaVerify(sig, key) === hashRRset(data, key.n);\r
\r
export interface Leaf { owner: string; type: string; value: string }\r
export interface Tamper { dsAtZone?: number; sigAtZone?: number; leafSig?: boolean }\r
\r
export interface Step { label: string; kind: 'anchor' | 'ds' | 'rrsig' | 'leaf'; ok: boolean; detail: string }\r
export interface Validation { steps: Step[]; secure: boolean; brokeAt: number }\r
\r
/** Walk the chain from the root trust anchor down to the leaf record. */\r
export function validateChain(zones: Zone[], leaf: Leaf, tamper: Tamper = {}): Validation {\r
  const steps: Step[] = [];\r
  steps.push({ label: \`\${zones[0].name || '.'} DNSKEY\`, kind: 'anchor', ok: true, detail: 'trusted directly — this is the resolver’s configured trust anchor' });\r
\r
  for (let i = 1; i < zones.length; i++) {\r
    const parent = zones[i - 1], child = zones[i];\r
    const realDs = digestKey(child.key);\r
    const storedDs = tamper.dsAtZone === i ? realDs.replace(/^./, (c) => (c === '0' ? '1' : '0')) : realDs;\r
    // the parent signs the DS RRset; both the signature AND the digest match must hold\r
    const dsRRset = \`DS \${child.name} \${storedDs}\`;\r
    const dsSig = signRRset(dsRRset, parent.key);\r
    const sigOk = tamper.sigAtZone === i ? false : verifyRRset(dsRRset, dsSig, parent.key);\r
    const digestOk = storedDs === realDs;\r
    const ok = sigOk && digestOk;\r
    steps.push({\r
      label: \`\${parent.name || '.'} → \${child.name} (DS)\`,\r
      kind: 'ds',\r
      ok,\r
      detail: !sigOk ? 'the parent’s RRSIG over the DS does not verify'\r
        : !digestOk ? 'the DS digest does not match the child’s DNSKEY — delegation broken'\r
        : \`DS = SHA-256(\${child.name} DNSKEY) matches, and the parent’s RRSIG verifies\`,\r
    });\r
    if (!ok) return { steps, secure: false, brokeAt: steps.length - 1 };\r
  }\r
\r
  const leafZone = zones[zones.length - 1];\r
  const rrset = \`\${leaf.owner} \${leaf.type} \${leaf.value}\`;\r
  const sig = signRRset(rrset, leafZone.key);\r
  const leafOk = tamper.leafSig ? false : verifyRRset(rrset, sig, leafZone.key);\r
  steps.push({\r
    label: \`\${leafZone.name} RRSIG over \${leaf.owner} \${leaf.type}\`,\r
    kind: 'leaf',\r
    ok: leafOk,\r
    detail: leafOk ? \`the \${leaf.type} record’s RRSIG verifies under \${leafZone.name}’s DNSKEY — answer is authentic\`\r
      : 'the answer’s RRSIG does not verify — the record was forged or altered',\r
  });\r
\r
  const secure = steps.every((s) => s.ok);\r
  return { steps, secure, brokeAt: secure ? -1 : steps.findIndex((s) => !s.ok) };\r
}\r
\r
/** A small, deterministic demo chain: root → com → example.com. */\r
export function demoZones(): Zone[] {\r
  return [\r
    { name: '', key: rsaKeygen(61n, 53n, 17n) },     // root (.)\r
    { name: 'com', key: rsaKeygen(59n, 67n, 17n) },\r
    { name: 'example.com', key: rsaKeygen(71n, 73n, 17n) },\r
  ];\r
}\r
`;export{e as default};