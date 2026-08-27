var e=`// IP anycast — one address, many locations. Several servers in different places all\r
// advertise the SAME IP prefix into BGP; the routing system then delivers each client's\r
// packets to whichever instance is topologically nearest (fewest-cost path). No client\r
// configuration, automatic failover (withdraw a site and its traffic re-routes to the\r
// next nearest), and natural load spreading by geography. It's how root DNS, public\r
// resolvers (1.1.1.1, 8.8.8.8), and CDNs/DDoS scrubbers work. Pure routing model, tested.\r
\r
export interface Site { id: number; name: string; up: boolean }\r
export interface Client { id: number; name: string; costs: number[] } // path cost to each site (by index)\r
\r
/** The nearest UP site for a client (lowest path cost; ties broken by lower id). */\r
export function nearest(client: Client, sites: Site[]): number | null {\r
  let best: number | null = null, bestCost = Infinity;\r
  for (const s of sites) {\r
    if (!s.up) continue;\r
    const c = client.costs[s.id];\r
    // strictly cheaper wins; on an exact tie the lower site id wins (independent of the\r
    // order \`sites\` is given in)\r
    if (c < bestCost || (c === bestCost && best !== null && s.id < best)) { bestCost = c; best = s.id; }\r
  }\r
  return best;\r
}\r
\r
export interface Distribution {\r
  assignment: Record<number, number | null>; // clientId → siteId (or null if all down)\r
  load: Record<number, number>;               // siteId → client count\r
  cost: Record<number, number>;               // clientId → path cost reached\r
}\r
\r
/** Route every client to its nearest up site and tally per-site load. */\r
export function distribute(clients: Client[], sites: Site[]): Distribution {\r
  const assignment: Record<number, number | null> = {};\r
  const load: Record<number, number> = {};\r
  const cost: Record<number, number> = {};\r
  for (const s of sites) load[s.id] = 0;\r
  for (const c of clients) {\r
    const site = nearest(c, sites);\r
    assignment[c.id] = site;\r
    cost[c.id] = site === null ? Infinity : c.costs[site];\r
    if (site !== null) load[site]++;\r
  }\r
  return { assignment, load, cost };\r
}\r
`;export{e as default};