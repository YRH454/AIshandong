var e=`// RPKI Route Origin Validation — the defense the BGP-hijack section calls for. RPKI is a PKI rooted at the RIRs in\r
// which a prefix holder publishes a signed Route Origin Authorization (ROA): "prefix P may be originated by AS N, for\r
// announcements no more specific than /L". A router doing Route Origin Validation (RFC 6811) checks each BGP\r
// announcement's (prefix, origin AS) against the ROAs it has and labels it Valid, Invalid, or NotFound, then applies a\r
// policy — the common one drops Invalid and keeps Valid and NotFound. This models that classification exactly; the\r
// signing/PKI is real RPKI but out of scope (we assume the ROAs are already validated).\r
\r
export interface Roa { prefix: string; maxLength: number; origin: number }\r
export interface Announcement { label: string; prefix: string; origin: number }\r
export type Validity = 'Valid' | 'Invalid' | 'NotFound';\r
\r
const parse = (cidr: string): { net: number; len: number } => {\r
  const [ip, lenStr] = cidr.split('/');\r
  const len = parseInt(lenStr, 10);\r
  const addr = ip.split('.').reduce((a, o) => ((a * 256 + (parseInt(o, 10) & 0xff)) >>> 0), 0) >>> 0;\r
  const mask = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0;\r
  return { net: (addr & mask) >>> 0, len };\r
};\r
\r
// Does the ROA's prefix cover (equal or less specific than) the announced prefix?  (Prefix containment only — RFC 6811\r
// uses this to decide NotFound; maxLength and origin are checked separately.)\r
function covers(roaCidr: string, annCidr: string): boolean {\r
  const r = parse(roaCidr), a = parse(annCidr);\r
  if (a.len < r.len) return false;                       // announcement is less specific → not covered\r
  const mask = r.len === 0 ? 0 : (0xffffffff << (32 - r.len)) >>> 0;\r
  return ((a.net & mask) >>> 0) === r.net;\r
}\r
\r
// RFC 6811 origin validation.\r
export function validate(roas: Roa[], ann: Announcement): { validity: Validity; reason: string } {\r
  const covering = roas.filter((r) => covers(r.prefix, ann.prefix));\r
  if (covering.length === 0) {\r
    return { validity: 'NotFound', reason: \`No ROA covers \${ann.prefix} — this is unsigned address space, so validation has nothing to say.\` };\r
  }\r
  const annLen = parse(ann.prefix).len;\r
  const matched = covering.find((r) => r.origin === ann.origin && annLen <= r.maxLength);\r
  if (matched) {\r
    return { validity: 'Valid', reason: \`A ROA authorizes AS\${ann.origin} to originate \${ann.prefix} (maxLength /\${matched.maxLength}).\` };\r
  }\r
  // Covered by a ROA but nothing validates it. Report the more-specific violation when the announcement exceeds every\r
  // covering ROA's maxLength (the distinctive fact of a sub-prefix hijack), otherwise the origin mismatch.\r
  const maxAllowed = Math.max(...covering.map((r) => r.maxLength));\r
  const reason = annLen > maxAllowed\r
    ? \`A ROA covers this prefix but only up to /\${maxAllowed}; a /\${annLen} announcement is more specific than allowed — a classic sub-prefix hijack (even the real owner can't announce it).\`\r
    : \`A ROA covers \${ann.prefix} but authorizes a different origin (AS\${covering[0].origin}), not AS\${ann.origin} — the announcement is a hijack.\`;\r
  return { validity: 'Invalid', reason };\r
}\r
\r
// Router policy: with Route Origin Validation enabled, drop Invalid; keep Valid and NotFound. Disabled → accept all.\r
export function accept(validity: Validity, rovEnabled: boolean): boolean {\r
  return !rovEnabled || validity !== 'Invalid';\r
}\r
\r
export const DEFAULT_ROAS = (): Roa[] => [{ prefix: '192.0.2.0/24', maxLength: 24, origin: 64500 }];\r
export const ANNOUNCEMENTS = (): Announcement[] => [\r
  { label: 'legit owner', prefix: '192.0.2.0/24', origin: 64500 },\r
  { label: 'same-prefix hijack', prefix: '192.0.2.0/24', origin: 64666 },\r
  { label: 'sub-prefix hijack', prefix: '192.0.2.0/25', origin: 64666 },\r
  { label: 'unsigned prefix', prefix: '198.51.100.0/24', origin: 64500 },\r
];\r
`;export{e as default};