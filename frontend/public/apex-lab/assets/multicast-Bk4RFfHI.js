var e=`// Multicast & IGMP (RFC 2236) — delivering one stream to many receivers without\r
// flooding everyone. A multicast group is a 224.0.0.0/4 address; a host JOINs by\r
// sending an IGMP membership report and LEAVEs when done. An IGMP-snooping switch\r
// watches those reports to learn which of its PORTS have a member of each group, so\r
// a multicast frame is forwarded ONLY out ports that have a joined member (unlike a\r
// broadcast, which hits every port). The upstream router keeps pulling the stream\r
// onto the segment only while ≥1 member exists, and PRUNES the group when the last\r
// member leaves. Pure, deterministic model. Tested.\r
\r
export interface Host { id: number; name: string; port: number }\r
\r
/** Per-group membership: which host ids have joined. */\r
export type Membership = Record<string, Set<number>>; // group address → joined host ids\r
\r
export function isMulticast(addr: string): boolean {\r
  const first = Number(addr.split('.')[0]);\r
  return first >= 224 && first <= 239; // 224.0.0.0 – 239.255.255.255\r
}\r
\r
export function join(m: Membership, group: string, hostId: number): Membership {\r
  const next: Membership = { ...m, [group]: new Set(m[group] ?? []) };\r
  next[group].add(hostId);\r
  return next;\r
}\r
\r
export function leave(m: Membership, group: string, hostId: number): Membership {\r
  const next: Membership = { ...m, [group]: new Set(m[group] ?? []) };\r
  next[group].delete(hostId);\r
  if (next[group].size === 0) delete next[group]; // last member → group pruned\r
  return next;\r
}\r
\r
/** The switch ports that have ≥1 member of \`group\` (IGMP snooping result). */\r
export function memberPorts(m: Membership, group: string, hosts: Host[]): number[] {\r
  const members = m[group] ?? new Set<number>();\r
  const ports = new Set<number>();\r
  for (const h of hosts) if (members.has(h.id)) ports.add(h.port);\r
  return [...ports].sort((a, b) => a - b);\r
}\r
\r
export interface Delivery {\r
  mode: 'multicast' | 'broadcast';\r
  delivered: number[]; // host ids that received the frame\r
  ports: number[]; // ports the switch forwarded out of\r
  pruned: boolean; // multicast: was the group empty (nothing forwarded)?\r
}\r
\r
/** Forward a frame for \`group\`: multicast → only members; broadcast → everyone. */\r
export function forward(m: Membership, group: string, hosts: Host[], mode: 'multicast' | 'broadcast'): Delivery {\r
  if (mode === 'broadcast') {\r
    return { mode, delivered: hosts.map((h) => h.id), ports: [...new Set(hosts.map((h) => h.port))].sort((a, b) => a - b), pruned: false };\r
  }\r
  const members = m[group] ?? new Set<number>();\r
  const delivered = hosts.filter((h) => members.has(h.id)).map((h) => h.id);\r
  return { mode, delivered, ports: memberPorts(m, group, hosts), pruned: delivered.length === 0 };\r
}\r
`;export{e as default};