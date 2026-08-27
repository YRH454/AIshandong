var e=`// WPA2 4-way handshake (IEEE 802.11i). Both the access point and your device already share\r
// a Pairwise Master Key (the PMK, derived from the Wi-Fi password). The handshake's job is\r
// to derive a fresh per-session Pairwise Transient Key (PTK) WITHOUT sending it, and to\r
// prove each side really holds the PMK. The AP sends a random ANonce; the station replies\r
// with its SNonce; now both sides have PMK + both nonces + both MAC addresses and compute\r
// the SAME PTK = PRF(PMK, "Pairwise key expansion", sorted MACs ‖ sorted nonces). A MIC\r
// (message integrity code keyed by part of the PTK) proves possession. Real HMAC; the\r
// derivation's properties (symmetry, freshness, secrecy) are tested. Real WPA2 uses an\r
// HMAC-SHA1 PRF; we use HMAC-SHA256 — the structure is identical.\r
import { hmacSha256 } from './hkdf';\r
import { hex } from './sha256';\r
\r
const enc = (s: string) => new TextEncoder().encode(s);\r
const lo = (a: string, b: string) => (a <= b ? a : b);\r
const hi = (a: string, b: string) => (a <= b ? b : a);\r
\r
/** PTK = PRF(PMK, label ‖ min(MACs) ‖ max(MACs) ‖ min(nonces) ‖ max(nonces)). The sorting\r
 *  is why both ends compute the same key regardless of who is AP vs station. */\r
export function derivePtk(pmk: string, apMac: string, staMac: string, aNonce: string, sNonce: string): string {\r
  const data = 'Pairwise key expansion' + lo(apMac, staMac) + hi(apMac, staMac) + lo(aNonce, sNonce) + hi(aNonce, sNonce);\r
  return hex(hmacSha256(enc(pmk), enc(data)));\r
}\r
\r
/** The MIC over a handshake message, keyed by the KCK (first 16 bytes of the PTK). */\r
export function mic(ptk: string, message: string): string {\r
  return hex(hmacSha256(enc(ptk.slice(0, 32)), enc(message))).slice(0, 16);\r
}\r
\r
export interface Msg { n: number; from: 'AP' | 'STA'; carries: string; apHasPtk: boolean; staHasPtk: boolean; note: string }\r
export interface Handshake { messages: Msg[]; apPtk: string; staPtk: string; match: boolean }\r
\r
export function handshake(pmk: string, apMac: string, staMac: string, aNonce: string, sNonce: string): Handshake {\r
  const apPtk = derivePtk(pmk, apMac, staMac, aNonce, sNonce);\r
  const staPtk = derivePtk(pmk, apMac, staMac, aNonce, sNonce);\r
  const messages: Msg[] = [\r
    { n: 1, from: 'AP', carries: \`ANonce = \${aNonce}\`, apHasPtk: false, staHasPtk: false, note: 'AP sends its random nonce (no MIC yet — the station has no PTK to key one)' },\r
    { n: 2, from: 'STA', carries: \`SNonce = \${sNonce} + MIC\`, apHasPtk: false, staHasPtk: true, note: 'station now has both nonces → derives the PTK, and proves it with a MIC' },\r
    { n: 3, from: 'AP', carries: 'GTK (group key) + MIC', apHasPtk: true, staHasPtk: true, note: 'AP derives the same PTK, verifies the station’s MIC, and sends the group key' },\r
    { n: 4, from: 'STA', carries: 'ACK + MIC', apHasPtk: true, staHasPtk: true, note: 'station confirms — both sides install the PTK and encryption begins' },\r
  ];\r
  return { messages, apPtk, staPtk, match: apPtk === staPtk };\r
}\r
`;export{e as default};