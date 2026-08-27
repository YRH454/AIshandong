var e=`// Subresource Integrity (SRI) — how a page pins the exact bytes of a script it loads from a CDN, so\r
// a compromised or swapped CDN file can't run. The author hashes the known-good file and puts the\r
// digest in the tag: <script src="//cdn/lib.js" integrity="sha256-…" crossorigin>. The browser\r
// fetches the file, hashes what it ACTUALLY received, and runs it only if the digest matches —\r
// otherwise the resource is blocked entirely. It's a content address: the hash IS the identity, so\r
// any tampering (even one byte) changes the hash and fails the check. We compute real SHA-256 (the\r
// same verified implementation used elsewhere) and base64-encode it exactly as SRI requires. Tested\r
// against the NIST SHA-256("abc") vector.\r
import { sha256 } from './sha256';\r
\r
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);\r
\r
function base64(bytes: Uint8Array): string {\r
  let bin = '';\r
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);\r
  return btoa(bin);\r
}\r
\r
/** The SRI metadata string for some content: "sha256-<base64 of the SHA-256 digest>". */\r
export function sriHash(content: string): string {\r
  return 'sha256-' + base64(sha256(enc(content)));\r
}\r
\r
export interface IntegrityResult {\r
  ok: boolean; // does the fetched content match the pinned digest?\r
  computed: string; // hash of what was actually served\r
  expected: string; // the integrity attribute the page pinned\r
  runs: boolean; // the browser executes the resource iff ok\r
}\r
\r
/** Verify served content against a pinned integrity attribute (the browser's SRI check). */\r
export function verifyIntegrity(servedContent: string, integrity: string): IntegrityResult {\r
  const computed = sriHash(servedContent);\r
  const ok = computed === integrity.trim();\r
  return { ok, computed, expected: integrity.trim(), runs: ok };\r
}\r
`;export{e as default};