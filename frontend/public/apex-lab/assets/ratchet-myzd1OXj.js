var e=`// The Signal Double Ratchet — how a messenger gives every message its own key, with\r
// forward secrecy (a compromise today can't read yesterday's messages) and post-\r
// compromise security (a fresh DH exchange heals a compromise). Two ratchets:\r
//   • symmetric-key ratchet: a one-way hash chain. Each message advances the chain\r
//     key (CK → CK') and spits out a message key (MK). Because the step is a hash,\r
//     you can't run it backward — delete MK after use and the past is unrecoverable.\r
//   • DH ratchet: when the peer sends a new DH public key, mix the new shared secret\r
//     into the ROOT key, reseeding the chains with entropy an attacker doesn't have.\r
// Real SHA-256 chains (from sha256.ts). A teaching model of the construction.\r
import { sha256, concatBytes } from './sha256';\r
\r
const kdf = (key: Uint8Array, label: number): Uint8Array => sha256(concatBytes(key, Uint8Array.from([label])));\r
\r
export interface SymStep { ck: Uint8Array; mk: Uint8Array }\r
\r
/** Advance the symmetric ratchet one message: MK = KDF(CK,1), CK' = KDF(CK,2). */\r
export function symStep(ck: Uint8Array): SymStep {\r
  return { mk: kdf(ck, 0x01), ck: kdf(ck, 0x02) };\r
}\r
\r
/** Produce \`n\` message keys from a starting chain key, returning the chain trace. */\r
export function chain(ck0: Uint8Array, n: number): { i: number; ck: Uint8Array; mk: Uint8Array }[] {\r
  let ck = ck0;\r
  const out: { i: number; ck: Uint8Array; mk: Uint8Array }[] = [];\r
  for (let i = 0; i < n; i++) { const s = symStep(ck); out.push({ i, ck, mk: s.mk }); ck = s.ck; }\r
  return out;\r
}\r
\r
export interface DhStep { rk: Uint8Array; ck: Uint8Array }\r
\r
/** DH ratchet: fold a fresh DH shared secret into the root key, reseeding a chain. */\r
export function dhStep(rk: Uint8Array, dhSecret: Uint8Array): DhStep {\r
  const t = sha256(concatBytes(rk, dhSecret));\r
  return { rk: kdf(t, 0x01), ck: kdf(t, 0x02) };\r
}\r
\r
export const shortHex = (b: Uint8Array, n = 4): string => [...b.subarray(0, n)].map((x) => x.toString(16).padStart(2, '0')).join('');\r
`;export{e as default};