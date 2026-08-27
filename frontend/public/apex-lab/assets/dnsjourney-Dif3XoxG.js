var e=`// The DNS resolution journey — how a name becomes an address (RFC 1034 §4.3).\r
// A stub resolver asks its recursive resolver one question; the resolver then\r
// walks the delegation hierarchy iteratively: root → TLD → authoritative, each\r
// server REFERRING it one label closer until an authoritative answer comes back.\r
// Caching short-circuits this — that's what TTL controls. Pure, tested model.\r
\r
export type RecordType = 'A' | 'AAAA' | 'NS' | 'CNAME';\r
export type ServerRole = 'stub' | 'recursive' | 'root' | 'tld' | 'authoritative';\r
\r
export interface DnsRecord { name: string; type: RecordType; value: string; ttl: number }\r
\r
export interface DnsHop {\r
  kind: 'query' | 'referral' | 'answer';\r
  from: ServerRole;\r
  to: ServerRole;\r
  qname: string;\r
  qtype: RecordType;\r
  // For a referral: the NS records handing off to the next tier. For an answer: the result.\r
  records: DnsRecord[];\r
  note: string;\r
  cached?: boolean; // this step was served from the resolver cache (no network hop)\r
}\r
\r
export interface DnsJourney {\r
  qname: string;\r
  qtype: RecordType;\r
  hops: DnsHop[];\r
  answer: DnsRecord | null;\r
}\r
\r
const ROOT_NS: DnsRecord = { name: '.', type: 'NS', value: 'a.root-servers.net', ttl: 518400 };\r
\r
/**\r
 * Resolve \`qname\` for \`qtype\` through the full hierarchy. If \`cacheHasAnswer\`,\r
 * the recursive resolver already holds the answer and returns it immediately\r
 * (one hop) — the everyday case once a name is warm.\r
 */\r
export function resolve(qname: string, qtype: RecordType = 'A', cacheHasAnswer = false): DnsJourney {\r
  const labels = qname.replace(/\\.$/, '').split('.');\r
  const tld = labels[labels.length - 1];\r
  const sld = labels.slice(-2).join('.'); // e.g. example.com\r
  const tldNs = \`a.gtld-servers.net\`;\r
  const authNs = \`ns1.\${sld}\`;\r
  const finalValue = qtype === 'AAAA' ? '2606:2800:220:1:248:1893:25c8:1946' : '93.184.216.34';\r
  const answer: DnsRecord = { name: qname, type: qtype, value: finalValue, ttl: 3600 };\r
\r
  const hops: DnsHop[] = [];\r
\r
  // 1. stub → recursive (always; this is the only question the client itself asks)\r
  hops.push({\r
    kind: 'query', from: 'stub', to: 'recursive', qname, qtype, records: [],\r
    note: \`Your device’s stub resolver asks its configured recursive resolver for \${qname} \${qtype}. This is the only DNS query your machine makes — the resolver does the legwork.\`,\r
  });\r
\r
  if (cacheHasAnswer) {\r
    hops.push({\r
      kind: 'answer', from: 'recursive', to: 'stub', qname, qtype, records: [answer], cached: true,\r
      note: \`The resolver already had \${qname} in cache (still within its \${answer.ttl}s TTL), so it answers immediately — no walk needed. This is why the second lookup of a site is instant.\`,\r
    });\r
    return { qname, qtype, hops, answer };\r
  }\r
\r
  // 2. recursive → root (referral to the TLD servers)\r
  hops.push({\r
    kind: 'referral', from: 'recursive', to: 'root', qname, qtype,\r
    records: [{ name: \`\${tld}.\`, type: 'NS', value: tldNs, ttl: 172800 }, ROOT_NS],\r
    note: \`The resolver starts at a root server (it knows the 13 root IPs from a built-in hints file). The root doesn’t know \${qname}, but it knows who runs “.\${tld}” and refers the resolver there.\`,\r
  });\r
\r
  // 3. recursive → TLD (referral to the authoritative servers)\r
  hops.push({\r
    kind: 'referral', from: 'recursive', to: 'tld', qname, qtype,\r
    records: [{ name: sld, type: 'NS', value: authNs, ttl: 172800 }],\r
    note: \`The .\${tld} servers don’t hold the address either, but they know which name servers are authoritative for \${sld}, and refer the resolver one step closer.\`,\r
  });\r
\r
  // 4. recursive → authoritative (the real answer)\r
  hops.push({\r
    kind: 'answer', from: 'authoritative', to: 'recursive', qname, qtype, records: [answer],\r
    note: \`The authoritative server for \${sld} holds the actual record and returns \${qname} \${qtype} = \${finalValue}. The resolver caches it for \${answer.ttl}s.\`,\r
  });\r
\r
  // 5. recursive → stub (deliver the cached answer back to the client)\r
  hops.push({\r
    kind: 'answer', from: 'recursive', to: 'stub', qname, qtype, records: [answer],\r
    note: \`The resolver hands the answer back to your stub resolver and remembers it, so the next lookup within \${answer.ttl}s skips the entire walk above.\`,\r
  });\r
\r
  return { qname, qtype, hops, answer };\r
}\r
`;export{e as default};