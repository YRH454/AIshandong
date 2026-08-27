var e=`// Magnet links & the infohash — trackerless torrents. A .torrent file needs a tracker AND ships the metadata file\r
// itself. A MAGNET link needs neither: it carries only the INFOHASH — the SHA-1 of the torrent's "info" dictionary\r
// (the piece list, sizes, names). The infohash is a CONTENT ADDRESS: it names the exact bytes, so any tampering\r
// yields a different hash, and it's all a client needs to (1) find peers via the DHT — get_peers(infohash), no\r
// tracker — and (2) fetch the metadata from those peers (BEP-9), verifying it against the infohash, then download\r
// the file (BEP-3). No central server to seize; the "address" is just a 160-bit number.\r
import { sha1 } from './sha1';\r
import { toHex } from './hashing';\r
\r
export type Magnet = { infohash: string; name?: string; trackers: string[] };\r
\r
// Parse a magnet URI (BEP-9 xt=urn:btih:<40-hex or 32-base32>).\r
export function parseMagnet(uri: string): Magnet | null {\r
  if (!uri.startsWith('magnet:?')) return null;\r
  const params = new URLSearchParams(uri.slice('magnet:?'.length));\r
  const xt = params.get('xt') ?? '';\r
  const m = xt.match(/^urn:btih:([0-9a-fA-F]{40}|[0-9a-fA-F]{32})$/);\r
  if (!m) return null;\r
  return { infohash: m[1].toLowerCase(), name: params.get('dn') ?? undefined, trackers: params.getAll('tr') };\r
}\r
\r
// A content address verifies: recompute the infohash of what you received and it must equal the one you asked for.\r
export function metadataVerifies(requestedInfohash: string, receivedInfohash: string): boolean {\r
  return requestedInfohash.toLowerCase() === receivedInfohash.toLowerCase();\r
}\r
\r
// ---- The real thing: derive the infohash from content, so tampering visibly changes the address. ----\r
\r
type Bencodable = number | string | Uint8Array | Bencodable[] | { [k: string]: Bencodable };\r
const te = new TextEncoder();\r
const bytesOf = (s: string) => te.encode(s);\r
function cat(chunks: Uint8Array[]): Uint8Array {\r
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));\r
  let o = 0;\r
  for (const c of chunks) { out.set(c, o); o += c.length; }\r
  return out;\r
}\r
\r
// Bencode (BEP-3): integers as i<n>e, byte-strings as <len>:<bytes>, lists as l…e, dicts as d…e with keys sorted\r
// by raw byte order. This is the exact canonical encoding a real client hashes to get an infohash.\r
export function bencode(v: Bencodable): Uint8Array {\r
  if (typeof v === 'number') {\r
    if (!Number.isInteger(v)) throw new Error('bencode: integers only');\r
    return bytesOf(\`i\${v}e\`);\r
  }\r
  if (typeof v === 'string') return bencode(bytesOf(v));\r
  if (v instanceof Uint8Array) return cat([bytesOf(\`\${v.length}:\`), v]);\r
  if (Array.isArray(v)) return cat([bytesOf('l'), ...v.map(bencode), bytesOf('e')]);\r
  const parts: Uint8Array[] = [bytesOf('d')];\r
  for (const k of Object.keys(v).sort()) { parts.push(bencode(k)); parts.push(bencode(v[k])); }\r
  parts.push(bytesOf('e'));\r
  return cat(parts);\r
}\r
\r
// Split the file into fixed-size pieces and SHA-1 each — this list is what the info dict commits to.\r
export function pieceHashes(data: Uint8Array, pieceLen: number): Uint8Array[] {\r
  const out: Uint8Array[] = [];\r
  for (let i = 0; i < data.length; i += pieceLen) out.push(sha1(data.slice(i, i + pieceLen)));\r
  return out;\r
}\r
\r
// The single-file "info" dictionary (BEP-3), bencoded. \`pieces\` is the concatenation of the 20-byte piece SHA-1s.\r
export function infoDict(name: string, pieceLen: number, data: Uint8Array): Uint8Array {\r
  const pieces = cat(pieceHashes(data, pieceLen));\r
  return bencode({ length: data.length, name, 'piece length': pieceLen, pieces });\r
}\r
\r
// The infohash = SHA-1 of the bencoded info dict. Flip one content bit → the piece hash changes → the info dict\r
// changes → the infohash changes. That is what "content address" means, and why a poisoned copy can't impersonate one.\r
export function infohashOf(name: string, pieceLen: number, data: Uint8Array): string {\r
  return toHex(sha1(infoDict(name, pieceLen, data)));\r
}\r
\r
// A received piece is trusted only if its SHA-1 equals the hash the info dict already committed to.\r
export function pieceVerifies(piece: Uint8Array, expectedHashHex: string): boolean {\r
  return toHex(sha1(piece)) === expectedHashHex.toLowerCase();\r
}\r
`;export{e as default};