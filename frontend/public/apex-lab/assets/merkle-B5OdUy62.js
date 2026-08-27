var e=`// Merkle tree (hash tree) — how you commit to a whole dataset with ONE hash and\r
// then prove any single item belongs, in log(n) hashes. Each leaf is the SHA-256 of\r
// a data block; every parent is the SHA-256 of its two children concatenated; the\r
// single top hash is the ROOT. An inclusion proof for a leaf is just the sibling\r
// hashes along its path: recompute upward with them and you must land on the root.\r
// Change any leaf and only its path (and the root) change — everything else is\r
// untouched. Real SHA-256 (src/web/sha256.ts). Used in git, blockchains, Cassandra\r
// anti-entropy, Certificate Transparency. Pure, tested.\r
import { sha256, hex, concatBytes } from './sha256';\r
\r
const enc = (s: string) => new TextEncoder().encode(s);\r
\r
/** Hash one leaf's data → 32-byte digest. */\r
export function leafHash(data: string): Uint8Array {\r
  return sha256(enc(data));\r
}\r
\r
/** Hash two child digests into their parent: SHA-256(left ‖ right). */\r
export function nodeHash(left: Uint8Array, right: Uint8Array): Uint8Array {\r
  return sha256(concatBytes(left, right));\r
}\r
\r
export interface MerkleTree {\r
  leaves: Uint8Array[]; // leaf hashes (bottom level)\r
  levels: Uint8Array[][]; // levels[0] = leaves … levels[top] = [root]\r
  root: Uint8Array;\r
}\r
\r
/** Build a Merkle tree from leaf data blocks (last node duplicated on odd levels). */\r
export function buildTree(blocks: string[]): MerkleTree {\r
  const leaves = blocks.map(leafHash);\r
  if (leaves.length === 0) return { leaves, levels: [[]], root: new Uint8Array(32) };\r
  const levels: Uint8Array[][] = [leaves];\r
  let level = leaves;\r
  while (level.length > 1) {\r
    const next: Uint8Array[] = [];\r
    for (let i = 0; i < level.length; i += 2) {\r
      const left = level[i];\r
      const right = i + 1 < level.length ? level[i + 1] : level[i]; // duplicate the last when odd\r
      next.push(nodeHash(left, right));\r
    }\r
    levels.push(next);\r
    level = next;\r
  }\r
  return { leaves, levels, root: level[0] };\r
}\r
\r
export interface ProofStep { hash: Uint8Array; position: 'left' | 'right' } // sibling and which side it sits on\r
\r
/** The inclusion proof for leaf \`index\`: the sibling hash at each level up to the root. */\r
export function inclusionProof(tree: MerkleTree, index: number): ProofStep[] {\r
  const proof: ProofStep[] = [];\r
  let idx = index;\r
  for (let l = 0; l < tree.levels.length - 1; l++) {\r
    const level = tree.levels[l];\r
    const isRight = idx % 2 === 1;\r
    const siblingIdx = isRight ? idx - 1 : idx + 1;\r
    const sibling = siblingIdx < level.length ? level[siblingIdx] : level[idx]; // duplicated last node\r
    proof.push({ hash: sibling, position: isRight ? 'left' : 'right' });\r
    idx = Math.floor(idx / 2);\r
  }\r
  return proof;\r
}\r
\r
/** Verify a proof: fold the leaf hash with each sibling and check it reaches the root. */\r
export function verifyProof(leaf: Uint8Array, proof: ProofStep[], root: Uint8Array): boolean {\r
  let acc = leaf;\r
  for (const step of proof) {\r
    acc = step.position === 'left' ? nodeHash(step.hash, acc) : nodeHash(acc, step.hash);\r
  }\r
  return hex(acc) === hex(root);\r
}\r
\r
/** Indices of the nodes on a leaf's path to the root (level → node index), for highlighting. */\r
export function pathIndices(tree: MerkleTree, index: number): number[] {\r
  const path: number[] = [];\r
  let idx = index;\r
  for (let l = 0; l < tree.levels.length; l++) { path.push(idx); idx = Math.floor(idx / 2); }\r
  return path;\r
}\r
\r
export { hex as hashHex };\r
`;export{e as default};