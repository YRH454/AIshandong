var e=`// DNS tunneling — a covert channel that smuggles data out of (and commands into) a locked-down network by hiding it\r
// in DNS. A firewall may block almost all outbound traffic, but it lets DNS through — everything needs name lookups.\r
// So malware hex-encodes its data across the SUBDOMAIN LABELS of queries to a domain the attacker controls; the\r
// attacker's authoritative server receives every query (recursive DNS delivers it) and decodes the labels back into\r
// data. Replies (TXT/CNAME records) carry commands the other way. It's slow and noisy — but it gets through.\r
\r
const HEX = (s: string) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');\r
const UNHEX = (h: string) => (h.match(/.{2}/g) ?? []).map((b) => String.fromCharCode(parseInt(b, 16))).join('');\r
\r
// Encode data into a series of DNS query names: <hex-chunk>.<tunnel-domain>. Labels are chunked to stay well under\r
// the 63-char DNS label limit.\r
export function encodeToQueries(data: string, domain: string, labelLen = 24): string[] {\r
  const hex = HEX(data);\r
  const chunks = hex.match(new RegExp(\`.{1,\${labelLen}}\`, 'g')) ?? [];\r
  return chunks.map((c) => \`\${c}.\${domain}\`);\r
}\r
\r
// The attacker's server strips the tunnel domain and decodes the concatenated labels back to the original data.\r
export function decodeFromQueries(queries: string[], domain: string): string {\r
  const suffix = '.' + domain;\r
  const hex = queries.map((q) => (q.endsWith(suffix) ? q.slice(0, -suffix.length) : q)).join('');\r
  return UNHEX(hex);\r
}\r
\r
// A crude detectability signal: normal DNS labels are short dictionary-ish words; tunnel labels are long random hex.\r
// A real IDS combines label length, character entropy, and query volume to one domain.\r
export function avgLabelLen(queries: string[], domain: string): number {\r
  const suffix = '.' + domain;\r
  const labels = queries.map((q) => (q.endsWith(suffix) ? q.slice(0, -suffix.length) : q));\r
  return labels.length ? labels.reduce((a, l) => a + l.length, 0) / labels.length : 0;\r
}\r
`;export{e as default};