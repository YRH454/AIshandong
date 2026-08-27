var e=`// BGP route reflectors — how iBGP scales past a few routers. The iBGP rule is that a router must NOT\r
// re-advertise a route learned from one iBGP peer to another iBGP peer (to prevent loops, since iBGP has\r
// no AS-path to detect them). The naive fix is a FULL MESH: every iBGP router peers with every other, so\r
// n routers need n(n−1)/2 sessions — 100 routers = 4,950 sessions, unmanageable. A route reflector is\r
// allowed to break that rule in a controlled way: its CLIENT routers peer only with it, and it REFLECTS\r
// routes between them, collapsing the mesh to a hub-and-spoke. The reflection rules keep it loop-free: a\r
// route from a client is reflected to all other clients AND to non-client iBGP peers; a route from a\r
// non-client (or eBGP) is reflected only to clients; and an ORIGINATOR_ID + CLUSTER_LIST stamp let a\r
// reflector drop a route that has already passed through its cluster. Reference: RFC 4456.\r
\r
/** Sessions in a full iBGP mesh of n routers — the O(n²) that route reflectors avoid. */\r
export const fullMeshSessions = (n: number) => (n * (n - 1)) / 2;\r
\r
export type PeerKind = 'client' | 'nonclient' | 'ebgp';\r
export interface Peer { id: string; kind: PeerKind }\r
\r
/** Sessions with a single route reflector: each client peers only with the RR; non-clients form their\r
 *  own full mesh with the RR (and each other). */\r
export function rrSessions(clients: number, nonClients: number): number {\r
  const rrAndNonClients = nonClients + 1;             // the RR plus the regular iBGP routers…\r
  return clients + fullMeshSessions(rrAndNonClients); // …form a small full mesh; clients are spokes\r
}\r
\r
/** Where does a route learned from a peer of \`sourceKind\` get reflected? (RFC 4456 §3.) */\r
export function reflect(sourceKind: PeerKind, peers: Peer[], sourceId: string): string[] {\r
  const others = peers.filter((p) => p.id !== sourceId);\r
  if (sourceKind === 'ebgp') return others.map((p) => p.id);                       // eBGP → everyone\r
  if (sourceKind === 'client') return others.map((p) => p.id);                     // client → other clients + non-clients\r
  // from a non-client iBGP peer → reflect ONLY to clients (non-clients already have it via their mesh)\r
  return others.filter((p) => p.kind === 'client').map((p) => p.id);\r
}\r
`;export{e as default};