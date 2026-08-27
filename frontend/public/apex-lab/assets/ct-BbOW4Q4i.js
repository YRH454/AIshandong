var e=`// Certificate Transparency (RFC 6962) — closing the "any CA can forge a cert for your domain and you'd never know"\r
// hole. Every certificate must be recorded in public, append-only MERKLE logs; a browser rejects a cert that doesn't\r
// carry a signed proof of logging (an SCT). That puts a rogue CA in a bind: log the forged cert and the domain\r
// owner's monitor sees it in the public log; skip logging and the browser rejects it. So a mis-issued cert is either\r
// blocked or discoverable — never both working and secret. The "it's in the log" proof is a Merkle inclusion proof.\r
import { buildTree, inclusionProof, verifyProof, leafHash, type ProofStep } from './merkle';\r
\r
export type Verdict = 'silent-compromise' | 'rejected' | 'caught' | 'accepted-unwatched';\r
\r
// The fate of a forged cert given whether browsers enforce CT (require an SCT), whether the attacker logged it (to\r
// obtain that SCT), and whether the domain owner monitors the logs.\r
export function certOutcome(ctEnforced: boolean, logged: boolean, monitored: boolean): {\r
  browserAccepts: boolean; detected: boolean; verdict: Verdict;\r
} {\r
  if (!ctEnforced) return { browserAccepts: true, detected: false, verdict: 'silent-compromise' };\r
  if (!logged) return { browserAccepts: false, detected: false, verdict: 'rejected' };\r
  // Logged ⇒ it has an SCT ⇒ browsers accept it, but it now sits in the public log for anyone watching.\r
  return { browserAccepts: true, detected: monitored, verdict: monitored ? 'caught' : 'accepted-unwatched' };\r
}\r
\r
// Build the log's Merkle tree over the cert list and produce the inclusion proof that a given cert is in it. The\r
// proof folds up to the log's root (the signed tree head) — reusing the tested merkle.ts primitives.\r
export function logInclusion(certs: string[], index: number): { root: Uint8Array; proof: ProofStep[]; verifies: boolean } {\r
  const tree = buildTree(certs);\r
  const proof = inclusionProof(tree, index);\r
  const verifies = verifyProof(leafHash(certs[index]), proof, tree.root);\r
  return { root: tree.root, proof, verifies };\r
}\r
`;export{e as default};