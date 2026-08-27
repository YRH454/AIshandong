var e=`// Onion (hidden) services — a server reachable by its .onion address with NO public IP, so neither side learns the\r
// other's location. The .onion address IS the service's public key (self-authenticating). Connection uses a\r
// rendezvous protocol: the service publishes a signed descriptor (its intro points) to the DHT; a client fetches it,\r
// picks a rendezvous relay, and asks — via an introduction point — the service to meet there; both build Tor circuits\r
// to the rendezvous, which only ever sees two circuits, never two IPs. Modelled: the mutual-anonymity property, and\r
// what an adversary who compromises a set of relays actually learns.\r
\r
export type RelayRole = { role: string; side?: 'client' | 'service' | 'shared'; seesClientIp: boolean; seesServiceIp: boolean };\r
\r
// The relays on the two 3-hop Tor circuits that meet at the rendezvous point. Only the GUARD nearest each end sees\r
// that end's IP; every interior relay (middles, rendezvous, intro point) sees only circuit traffic, never an endpoint.\r
export const TOPOLOGY: RelayRole[] = [\r
  { role: "client's guard", side: 'client', seesClientIp: true, seesServiceIp: false },\r
  { role: "client's middle", side: 'client', seesClientIp: false, seesServiceIp: false },\r
  { role: 'rendezvous point', side: 'shared', seesClientIp: false, seesServiceIp: false },\r
  { role: "service's middle", side: 'service', seesClientIp: false, seesServiceIp: false },\r
  { role: "service's guard", side: 'service', seesClientIp: false, seesServiceIp: true },\r
  { role: 'introduction point', side: 'service', seesClientIp: false, seesServiceIp: false },\r
];\r
\r
// Who learns what in a fully-built onion-service connection (each side reaches the rendezvous over its own circuit).\r
export function rendezvousKnowledge(): RelayRole[] {\r
  return TOPOLOGY;\r
}\r
\r
// Mutual anonymity: no single relay sees BOTH the client's and the service's IP.\r
export function mutuallyAnonymous(k: RelayRole[]): boolean {\r
  return !k.some((r) => r.seesClientIp && r.seesServiceIp);\r
}\r
\r
export type Adversary = { seesClientIp: boolean; seesServiceIp: boolean; canDeanonymize: boolean };\r
\r
// What an adversary who has compromised a SET of relays learns. A single relay never sees both ends, so deanonymizing\r
// requires collecting the client's IP from one controlled relay AND the service's IP from another — in practice, both\r
// guards (the guard-discovery / end-to-end correlation attack). Controlling only interior relays reveals nothing.\r
export function adversaryView(controlled: RelayRole[]): Adversary {\r
  const seesClientIp = controlled.some((r) => r.seesClientIp);\r
  const seesServiceIp = controlled.some((r) => r.seesServiceIp);\r
  return { seesClientIp, seesServiceIp, canDeanonymize: seesClientIp && seesServiceIp };\r
}\r
\r
// The .onion address is self-authenticating: it's derived from the service's public key, so a client can verify the\r
// descriptor's signature against the address itself — no certificate authority needed.\r
export function selfAuthenticates(onionAddrIsPubkey: boolean, descriptorSignedByKey: boolean): boolean {\r
  return onionAddrIsPubkey && descriptorSignedByKey;\r
}\r
`;export{e as default};