var e=`// Models for "attacks, made visible" — the numbers are real and sourced, so the\r
// danger is legible rather than hand-waved. Educational/defensive only.\r
\r
// Bandwidth Amplification Factors from US-CERT alert TA14-017 (UDP-based reflection\r
// & amplification), plus the 2018 memcached event (≈1.35 Tbps against GitHub).\r
export interface Reflector {\r
  id: string;\r
  name: string;\r
  baf: number; // bandwidth amplification factor (response ÷ request)\r
  source: string;\r
}\r
export const REFLECTORS: Reflector[] = [\r
  { id: 'memcached', name: 'Memcached (UDP 11211)', baf: 51000, source: 'GitHub 2018, ~1.35 Tbps' },\r
  { id: 'ntp', name: 'NTP monlist (UDP 123)', baf: 556.9, source: 'US-CERT TA14-017 / CVE-2013-5211' },\r
  { id: 'chargen', name: 'CharGen (UDP 19)', baf: 358.8, source: 'US-CERT TA14-017' },\r
  { id: 'dns', name: 'DNS ANY (UDP 53)', baf: 54, source: 'US-CERT TA14-017 (28–54×)' },\r
  { id: 'ssdp', name: 'SSDP / UPnP (UDP 1900)', baf: 30.8, source: 'US-CERT TA14-017' },\r
  { id: 'snmp', name: 'SNMP GetBulk (UDP 161)', baf: 6.3, source: 'US-CERT TA14-017' },\r
];\r
\r
/** Victim-facing flood (Gbps) from an attacker's uplink (Mbps) through a reflector. */\r
export function floodGbps(uplinkMbps: number, baf: number): number {\r
  return (uplinkMbps * baf) / 1000;\r
}\r
\r
// ---- SYN flood: the half-open connection table ------------------------------\r
\r
export interface SynFloodModel {\r
  backlog: number; // SYN-RECV slots available\r
  filledSlots: number; // slots a flood holds at steady state\r
  saturated: boolean; // is the backlog full (legit clients rejected)?\r
  fillSeconds: number; // time for the flood to fill an empty backlog\r
}\r
\r
/**\r
 * A spoofed SYN leaves a half-open entry that lingers until the SYN-ACK retries\r
 * time out. If synRate × timeout exceeds the backlog, the table stays full and\r
 * legitimate handshakes are dropped — until SYN cookies are enabled.\r
 */\r
export function synFlood(backlog: number, synRatePerSec: number, holdSeconds: number): SynFloodModel {\r
  const wouldHold = synRatePerSec * holdSeconds;\r
  const filledSlots = Math.min(backlog, Math.round(wouldHold));\r
  return {\r
    backlog,\r
    filledSlots,\r
    saturated: wouldHold >= backlog,\r
    fillSeconds: synRatePerSec > 0 ? backlog / synRatePerSec : Infinity,\r
  };\r
}\r
`;export{e as default};