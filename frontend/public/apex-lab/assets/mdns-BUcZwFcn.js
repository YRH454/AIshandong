var e=`// mDNS + DNS-SD (RFC 6762 / 6763) — how your laptop finds the printer with no DNS\r
// server at all. mDNS is ordinary DNS wire format, but queries go to the multicast\r
// group 224.0.0.251 (ff02::fb on v6), UDP 5353, and names live under .local. Every\r
// device both asks and answers. DNS-SD layers a record chain on top: a PTR lists\r
// the instances of a service type, an SRV gives an instance's host+port, TXT carries\r
// metadata, and A/AAAA resolves the host to an address. Pure model; the record types\r
// and ports are real.\r
\r
export interface Service {\r
  instance: string; // human label, e.g. "Office LaserJet"\r
  type: string; // service type, e.g. "_ipp._tcp.local"\r
  host: string; // .local hostname\r
  port: number;\r
  ip: string;\r
  txt: Record<string, string>; // DNS-SD TXT key/value metadata\r
}\r
\r
export const MDNS_GROUP = '224.0.0.251';\r
export const MDNS_GROUP_V6 = 'ff02::fb';\r
export const MDNS_PORT = 5353;\r
\r
export const isLocal = (name: string): boolean => name.endsWith('.local');\r
\r
/** A demo LAN of advertised services. */\r
export const SERVICES: Service[] = [\r
  { instance: 'Office LaserJet', type: '_ipp._tcp.local', host: 'laserjet.local', port: 631, ip: '192.168.1.20', txt: { ty: 'HP LaserJet Pro', rp: 'ipp/print', pdl: 'application/pdf', Color: 'T' } },\r
  { instance: 'Living Room', type: '_airplay._tcp.local', host: 'appletv.local', port: 7000, ip: '192.168.1.31', txt: { model: 'AppleTV6,2', deviceid: 'AA:BB:CC:DD:EE:FF' } },\r
  { instance: 'Kitchen', type: '_airplay._tcp.local', host: 'homepod.local', port: 7000, ip: '192.168.1.32', txt: { model: 'AudioAccessory5,1' } },\r
  { instance: 'dev-server', type: '_http._tcp.local', host: 'devbox.local', port: 8080, ip: '192.168.1.50', txt: { path: '/' } },\r
  { instance: 'Family TV', type: '_googlecast._tcp.local', host: 'chromecast.local', port: 8009, ip: '192.168.1.40', txt: { md: 'Chromecast', fn: 'Family TV' } },\r
];\r
\r
/** Distinct service types advertised on the link (what a browser would discover). */\r
export const serviceTypes = (services: Service[]): string[] => [...new Set(services.map((s) => s.type))].sort();\r
\r
/** A PTR query for \`type\` returns the instances offering it. */\r
export const browse = (services: Service[], type: string): Service[] => services.filter((s) => s.type === type);\r
\r
export interface DnsRecord { kind: 'PTR' | 'SRV' | 'TXT' | 'A'; name: string; value: string }\r
\r
/** The DNS-SD record chain that resolves one instance to a connectable address. */\r
export function resolve(s: Service): DnsRecord[] {\r
  return [\r
    { kind: 'PTR', name: s.type, value: \`\${s.instance}.\${s.type}\` },\r
    { kind: 'SRV', name: \`\${s.instance}.\${s.type}\`, value: \`\${s.host}:\${s.port}\` },\r
    { kind: 'TXT', name: \`\${s.instance}.\${s.type}\`, value: Object.entries(s.txt).map(([k, v]) => \`\${k}=\${v}\`).join(' ') },\r
    { kind: 'A', name: s.host, value: s.ip },\r
  ];\r
}\r
\r
/** The full connection target, the point of the whole exercise. */\r
export const target = (s: Service): string => \`\${s.ip}:\${s.port}\`;\r
`;export{e as default};