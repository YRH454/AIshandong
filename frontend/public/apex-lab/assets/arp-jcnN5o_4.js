var e=`// ARP (RFC 826) — the glue between Layer 3 and Layer 2. To send an IP packet to a\r
// host on the same LAN, you need that host's MAC address. ARP finds it: check your\r
// ARP cache; on a miss, BROADCAST "who has 192.168.1.5? tell me", the owner UNICASTS\r
// "192.168.1.5 is at aa:bb:cc:..." and you cache the answer. A gratuitous ARP is an\r
// unsolicited announcement of your own IP→MAC, used to refresh everyone's cache when\r
// an IP moves (failover). Pure, deterministic model. Tested. (The Attacks section\r
// shows the ABUSE of this trust; here is the legitimate mechanism.)\r
\r
export interface Host { ip: string; mac: string; name: string }\r
export interface CacheEntry { mac: string; age: number }\r
export type Cache = Record<string, CacheEntry>; // ip → entry\r
\r
export type Step =\r
  | { kind: 'cache-hit'; ip: string; mac: string }\r
  | { kind: 'broadcast'; ip: string; from: string }\r
  | { kind: 'reply'; ip: string; mac: string; from: string }\r
  | { kind: 'learned'; ip: string; mac: string }\r
  | { kind: 'unresolved'; ip: string };\r
\r
export interface ResolveResult {\r
  mac: string | null; // the resolved MAC, or null if nobody owns the IP\r
  broadcast: boolean; // did we have to ARP (cache miss)?\r
  steps: Step[]; // the sequence for the UI\r
  cache: Cache; // the requester's cache AFTER resolving\r
}\r
\r
/**\r
 * Resolve \`targetIp\` from \`requester\`'s point of view, given the requester's cache\r
 * and who is on the LAN. Mutates a COPY of the cache and returns it.\r
 */\r
export function resolve(requester: Host, targetIp: string, cache: Cache, lan: Host[], now: number): ResolveResult {\r
  const next: Cache = { ...cache };\r
  const steps: Step[] = [];\r
\r
  const cached = next[targetIp];\r
  if (cached) {\r
    steps.push({ kind: 'cache-hit', ip: targetIp, mac: cached.mac });\r
    return { mac: cached.mac, broadcast: false, steps, cache: next };\r
  }\r
\r
  // cache miss → broadcast a who-has request\r
  steps.push({ kind: 'broadcast', ip: targetIp, from: requester.ip });\r
  const owner = lan.find((h) => h.ip === targetIp && h.ip !== requester.ip);\r
  if (!owner) {\r
    steps.push({ kind: 'unresolved', ip: targetIp });\r
    return { mac: null, broadcast: true, steps, cache: next };\r
  }\r
  // the owner unicasts an is-at reply; requester learns it\r
  steps.push({ kind: 'reply', ip: targetIp, mac: owner.mac, from: owner.ip });\r
  next[targetIp] = { mac: owner.mac, age: now };\r
  steps.push({ kind: 'learned', ip: targetIp, mac: owner.mac });\r
  return { mac: owner.mac, broadcast: true, steps, cache: next };\r
}\r
\r
/**\r
 * A gratuitous ARP from \`announcer\`: every other host that ALREADY had an entry for\r
 * the announcer's IP updates it (and a configurable \`populateAll\` would add it to\r
 * everyone, the aggressive variant). Returns each host's updated cache.\r
 */\r
export function gratuitous(announcer: Host, caches: Record<string, Cache>, now: number): Record<string, Cache> {\r
  const out: Record<string, Cache> = {};\r
  for (const [hostIp, cache] of Object.entries(caches)) {\r
    if (hostIp === announcer.ip) { out[hostIp] = { ...cache }; continue; }\r
    const updated: Cache = { ...cache };\r
    if (updated[announcer.ip]) updated[announcer.ip] = { mac: announcer.mac, age: now }; // refresh existing\r
    out[hostIp] = updated;\r
  }\r
  return out;\r
}\r
`;export{e as default};