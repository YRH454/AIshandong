var e=`// BitTorrent (BEP-3) core mechanics, modelled honestly. A file is split into fixed-size PIECES. A SWARM of peers\r
// each holds some pieces (a bitfield); you download from MANY peers at once. Two ideas keep a swarm healthy:\r
//  • RAREST-FIRST piece selection — always fetch the piece the FEWEST peers have, so no piece goes extinct when a\r
//    seed leaves, and copies spread evenly.\r
//  • CHOKE/UNCHOKE with TIT-FOR-TAT — you only upload ("unchoke") to the few peers giving you the best download\r
//    rate, reciprocating; plus one OPTIMISTIC unchoke (a random other peer) to discover better partners. Freeloaders\r
//    who never upload get choked.\r
\r
export type Peer = { id: string; name: string; has: boolean[]; seed: boolean };\r
\r
// rarity[i] = how many peers in the swarm currently hold piece i\r
export function rarity(peers: Peer[], nPieces: number): number[] {\r
  const r = new Array(nPieces).fill(0);\r
  for (const p of peers) for (let i = 0; i < nPieces; i++) if (p.has[i]) r[i]++;\r
  return r;\r
}\r
\r
// rarest-first: among pieces you lack (that some peer has), pick the one the fewest peers hold; ties → lowest index.\r
export function rarestFirst(mine: boolean[], peers: Peer[]): number {\r
  const r = rarity(peers, mine.length);\r
  let best = -1, bestR = Infinity;\r
  for (let i = 0; i < mine.length; i++) {\r
    if (mine[i] || r[i] === 0) continue;\r
    if (r[i] < bestR) { bestR = r[i]; best = i; }\r
  }\r
  return best;\r
}\r
\r
// who to fetch piece i from: prefer a NON-seed peer that has it (spread load off the seed, as real clients do), and\r
// fall back to the seed only when it's the sole source — so single-source pieces come from the seed and common ones\r
// spread across the swarm.\r
export function providerOf(peers: Peer[], i: number): Peer | null {\r
  return peers.find((p) => !p.seed && p.has[i]) ?? peers.find((p) => p.has[i]) ?? null;\r
}\r
\r
// tit-for-tat unchoke: rank peers by the rate they've given you, unchoke the top k, plus one optimistic peer.\r
export function unchoke(rates: Record<string, number>, peers: Peer[], k: number, optimistic: string | null): Set<string> {\r
  const ranked = [...peers].sort((a, b) => (rates[b.id] ?? 0) - (rates[a.id] ?? 0));\r
  const set = new Set(ranked.slice(0, k).map((p) => p.id));\r
  if (optimistic) set.add(optimistic);\r
  return set;\r
}\r
\r
export const complete = (bits: boolean[]): boolean => bits.every(Boolean);\r
`;export{e as default};