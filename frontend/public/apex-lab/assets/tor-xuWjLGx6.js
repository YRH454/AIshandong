var e=`// Onion routing (Tor), modelled at the level of its actual security guarantee. Your traffic is wrapped in one\r
// encryption layer per relay in a 3-hop circuit (guard → middle → exit). Each relay removes EXACTLY ONE layer,\r
// learning only the hop it received from and the hop to forward to — never both who you are and where you're going.\r
// So no single relay links sender to destination; de-anonymising you needs the guard AND the exit to collude (or a\r
// global traffic-correlation adversary). The layering is illustrated conceptually; what is modelled + TESTED here is\r
// the who-knows-what unlinkability property, which is the whole point of onion routing.\r
\r
export type Relay = { id: string; name: string; country: string };\r
export type Hop = {\r
  relay: Relay;\r
  index: number;\r
  prevHop: string;   // what this relay sees the cell coming FROM\r
  nextHop: string;   // what this relay forwards the cell TO\r
  layersLeft: number; // encryption layers still wrapped when this relay is done peeling\r
  seesOrigin: boolean; // does this relay know the real sender?\r
  seesDest: boolean;   // does this relay know the final destination?\r
  seesContent: boolean; // can this relay read the payload? (only the exit, and only if the site is plain HTTP)\r
};\r
\r
const ORIGIN = 'you';\r
\r
// Walk a circuit you → r0(guard) → r1(middle) → r2(exit) → dest and report what each relay learns as it peels its layer.\r
export function circuitHops(circuit: Relay[], dest: string): Hop[] {\r
  const n = circuit.length;\r
  return circuit.map((relay, i) => ({\r
    relay,\r
    index: i,\r
    prevHop: i === 0 ? ORIGIN : circuit[i - 1].name,\r
    nextHop: i === n - 1 ? dest : circuit[i + 1].name,\r
    layersLeft: n - 1 - i,\r
    seesOrigin: i === 0,          // only the guard talks directly to you\r
    seesDest: i === n - 1,        // only the exit talks to the destination\r
    seesContent: i === n - 1,     // only the exit sees the (still TLS-encrypted unless plain HTTP) payload\r
  }));\r
}\r
\r
// The core guarantee: with >=2 relays, NO single relay sees both the origin and the destination.\r
export function anySingleRelayLinksYou(hops: Hop[]): boolean {\r
  return hops.some((h) => h.seesOrigin && h.seesDest);\r
}\r
\r
// A correlation/collusion attack succeeds only if the endpoints of the circuit (guard + exit) are both adversarial.\r
export function deanonymisedBy(hops: Hop[], compromised: Set<string>): boolean {\r
  const guard = hops.find((h) => h.seesOrigin);\r
  const exit = hops.find((h) => h.seesDest);\r
  return !!guard && !!exit && compromised.has(guard.relay.id) && compromised.has(exit.relay.id);\r
}\r
\r
export const DEFAULT_CIRCUIT: Relay[] = [\r
  { id: 'g', name: 'Guard', country: '🇩🇪 DE' },\r
  { id: 'm', name: 'Middle', country: '🇳🇱 NL' },\r
  { id: 'e', name: 'Exit', country: '🇸🇪 SE' },\r
];\r
`;export{e as default};