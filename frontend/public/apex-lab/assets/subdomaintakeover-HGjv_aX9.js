var e=`// Subdomain takeover — how a forgotten DNS record hands an attacker a real page on YOUR domain. You point\r
// blog.example.com at a cloud service with a CNAME (→ example.github.io, myapp.herokuapp.com, an S3 bucket…).\r
// Later you delete the GitHub Pages repo / tear down the Heroku app / empty the bucket — but you FORGET to\r
// remove the DNS record. Now blog.example.com is a "dangling" CNAME pointing at an unclaimed name on a shared\r
// provider. If that provider lets ANYONE register the name (create a repo/app/bucket with it), an attacker\r
// does exactly that and now serves their content — phishing, cookie theft, a valid TLS cert for your\r
// subdomain — from blog.example.com. The whole class exists because the DNS record outlives the resource it\r
// pointed to. The fix is lifecycle hygiene (delete DNS with the resource) and providers that require domain\r
// verification before serving a custom hostname. References: Detectify "Hostile Subdomain Takeover"; the\r
// can-i-take-over-xyz catalog.\r
\r
export type Status = 'safe' | 'dangling' | 'takeover';\r
export interface DnsRecord { subdomain: string; target: string; live: boolean } // live = the backing resource still exists & is yours\r
\r
// A CNAME target is a takeover vector if it's on a shared provider that lets anyone claim an unused hostname.\r
const PROVIDERS: { match: string; name: string; reclaimable: boolean }[] = [\r
  { match: 'github.io', name: 'GitHub Pages', reclaimable: true },\r
  { match: 'herokuapp.com', name: 'Heroku', reclaimable: true },\r
  { match: 's3.amazonaws.com', name: 'AWS S3', reclaimable: true },\r
  { match: 's3-website', name: 'AWS S3', reclaimable: true },\r
  { match: 'azurewebsites.net', name: 'Azure App Service', reclaimable: true },\r
  { match: 'cloudapp.net', name: 'Azure Cloud', reclaimable: true },\r
  { match: 'fastly.net', name: 'Fastly', reclaimable: true },\r
  { match: 'ghost.io', name: 'Ghost', reclaimable: true },\r
  // providers that require domain verification before serving a hostname → NOT reclaimable by a stranger\r
  { match: 'myshopify.com', name: 'Shopify (verified)', reclaimable: false },\r
  { match: 'cloudfront.net', name: 'CloudFront (verified)', reclaimable: false },\r
];\r
\r
/** Which shared provider a CNAME target belongs to, if any. */\r
export function providerOf(target: string): { name: string; reclaimable: boolean } | null {\r
  const t = target.toLowerCase();\r
  const p = PROVIDERS.find((x) => t.includes(x.match));\r
  return p ? { name: p.name, reclaimable: p.reclaimable } : null;\r
}\r
\r
export interface Verdict { subdomain: string; provider: string | null; status: Status; reason: string }\r
\r
/** Classify a DNS record for takeover risk. */\r
export function classify(r: DnsRecord): Verdict {\r
  const prov = providerOf(r.target);\r
  if (r.live) return { subdomain: r.subdomain, provider: prov?.name ?? null, status: 'safe', reason: prov ? \`points to a live \${prov.name} resource you control\` : 'points to a live resource' };\r
  if (!prov) return { subdomain: r.subdomain, provider: null, status: 'dangling', reason: 'the target is gone, but it is not a known claim-anyone provider — no takeover vector, just a broken link' };\r
  if (prov.reclaimable) return { subdomain: r.subdomain, provider: prov.name, status: 'takeover', reason: \`dangling CNAME to \${prov.name}, where anyone can register the unused name → attacker serves content on \${r.subdomain}\` };\r
  return { subdomain: r.subdomain, provider: prov.name, status: 'dangling', reason: \`\${prov.name} requires domain verification before serving a hostname — dangling but not claimable by a stranger\` };\r
}\r
`;export{e as default};