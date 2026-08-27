var e=`// Hash chain — the tamper-evidence trick at the heart of blockchains, Git, certificate-\r
// transparency logs, and append-only audit logs. Each block stores the HASH OF THE PREVIOUS\r
// block alongside its own data, and its own hash is computed over (data ‖ prevHash). That one\r
// link makes the chain immutable in practice: change any block's data and its hash changes,\r
// which breaks the prevHash stored in the NEXT block, whose hash then changes too — the\r
// damage cascades all the way to the tip. So a single stored "tip" hash certifies the entire\r
// history. (A blockchain adds proof-of-work so rewriting also costs compute; here we show the\r
// linking itself.) Real SHA-256; tested.\r
import { sha256, hex } from './sha256';\r
\r
export interface Block { index: number; data: string; prevHash: string; hash: string }\r
\r
const GENESIS_PREV = '0'.repeat(64);\r
\r
/** A block's hash is SHA-256 over index ‖ data ‖ prevHash. */\r
export function blockHash(index: number, data: string, prevHash: string): string {\r
  return hex(sha256(new TextEncoder().encode(\`\${index}|\${data}|\${prevHash}\`)));\r
}\r
\r
/** Build a chain where each block links to the previous one's hash. */\r
export function buildChain(items: string[]): Block[] {\r
  const chain: Block[] = [];\r
  let prevHash = GENESIS_PREV;\r
  items.forEach((data, index) => {\r
    const hash = blockHash(index, data, prevHash);\r
    chain.push({ index, data, prevHash, hash });\r
    prevHash = hash;\r
  });\r
  return chain;\r
}\r
\r
export interface Check { index: number; recomputed: string; valid: boolean }\r
\r
/** Re-derive every block's hash live, chaining from genesis through CURRENT data, and compare\r
 *  to the committed hash. Tampering one block's data changes its live hash, which feeds the\r
 *  next block's link — so the mismatch CASCADES from the tampered block to the tip. */\r
export function verify(chain: Block[]): { checks: Check[]; valid: boolean; firstBroken: number | null } {\r
  let prevLive = GENESIS_PREV;\r
  const checks: Check[] = chain.map((b) => {\r
    const recomputed = blockHash(b.index, b.data, prevLive); // uses the LIVE previous hash\r
    prevLive = recomputed;\r
    return { index: b.index, recomputed, valid: recomputed === b.hash };\r
  });\r
  const firstBroken = checks.findIndex((c) => !c.valid);\r
  return { checks, valid: firstBroken === -1, firstBroken: firstBroken === -1 ? null : firstBroken };\r
}\r
\r
/** Edit one block's data, leaving its committed hash stale — exactly what verify() catches,\r
 *  with the break rippling from this block to the tip. */\r
export function tamper(chain: Block[], index: number, newData: string): Block[] {\r
  return chain.map((b, i) => (i === index ? { ...b, data: newData } : b));\r
}\r
\r
export { GENESIS_PREV };\r
`;export{e as default};