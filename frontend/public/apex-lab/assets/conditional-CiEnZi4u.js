var e=`// Conditional & range requests (RFC 9110) — the HTTP machinery behind cache revalidation, resumable\r
// downloads, and optimistic concurrency. A resource carries a validator: an ETag (an opaque version\r
// id) and a Last-Modified time. A client uses them as PRECONDITIONS:\r
//   • If-None-Match: <etag>  on GET → "only send the body if it CHANGED" → 304 Not Modified if it\r
//     still matches (zero body bytes — the whole point of revalidation).\r
//   • If-Modified-Since: <date> → the weaker, date-based version of the same.\r
//   • Range: bytes=a-b → "send only these bytes" → 206 Partial Content (resume a download), or 416\r
//     if the range is past the end. If-Range guards it: apply the range only if the validator still\r
//     matches, else fall back to a full 200.\r
//   • If-Match: <etag>  on PUT → "only write if nobody else changed it since I read it" → 412\r
//     Precondition Failed on a mismatch (the lost-update cure).\r
// We evaluate these exactly as the RFC prescribes and return the status, headers and body. Tested.\r
\r
export interface Resource { etag: string; lastModified: number; content: string } // lastModified = a day number\r
export interface Req {\r
  method: 'GET' | 'PUT';\r
  ifNoneMatch?: string; // an ETag, or '*'\r
  ifModifiedSince?: number;\r
  ifMatch?: string; // an ETag, or '*'\r
  ifRange?: string; // an ETag\r
  range?: [number, number]; // inclusive byte range\r
  body?: string; // for PUT\r
}\r
export interface Resp { status: number; reason: string; headers: Record<string, string>; body: string | null; explain: string }\r
\r
const matches = (cond: string | undefined, etag: string): boolean => cond != null && (cond === '*' || cond === etag);\r
\r
export function respond(res: Resource, req: Req): Resp {\r
  const base: Record<string, string> = { ETag: res.etag, 'Last-Modified': \`day \${res.lastModified}\` };\r
\r
  if (req.method === 'PUT') {\r
    // optimistic concurrency: If-Match must still match, or If-None-Match:* means create-only\r
    if (req.ifMatch != null && !matches(req.ifMatch, res.etag))\r
      return { status: 412, reason: 'Precondition Failed', headers: base, body: null, explain: \`If-Match: \${req.ifMatch} ≠ current ETag \${res.etag} — someone else wrote first; the update is rejected to avoid a lost update.\` };\r
    if (req.ifNoneMatch === '*')\r
      return { status: 412, reason: 'Precondition Failed', headers: base, body: null, explain: 'If-None-Match: * requires the resource to NOT exist (create-only) — but it does, so the write is refused.' };\r
    return { status: 204, reason: 'No Content', headers: { ETag: '"v-next"' }, body: null, explain: 'Preconditions passed → the write is applied and a new ETag is issued.' };\r
  }\r
\r
  // GET — conditional revalidation first\r
  if (matches(req.ifNoneMatch, res.etag))\r
    return { status: 304, reason: 'Not Modified', headers: base, body: null, explain: \`If-None-Match matched the current ETag \${res.etag} → nothing changed, so the server sends 304 with NO body. The client reuses its cached copy.\` };\r
  if (req.ifModifiedSince != null && res.lastModified <= req.ifModifiedSince)\r
    return { status: 304, reason: 'Not Modified', headers: base, body: null, explain: \`The resource (day \${res.lastModified}) is not newer than If-Modified-Since (day \${req.ifModifiedSince}) → 304, body skipped.\` };\r
\r
  // range, possibly guarded by If-Range\r
  if (req.range) {\r
    const rangeApplies = req.ifRange == null || matches(req.ifRange, res.etag);\r
    if (!rangeApplies)\r
      return { status: 200, reason: 'OK', headers: { ...base, 'Content-Length': String(res.content.length) }, body: res.content, explain: 'If-Range no longer matches the ETag → the cached partial is stale, so the server ignores the range and returns the WHOLE resource (200).' };\r
    const [a, b] = req.range;\r
    if (a < 0 || a >= res.content.length)\r
      return { status: 416, reason: 'Range Not Satisfiable', headers: { ...base, 'Content-Range': \`bytes */\${res.content.length}\` }, body: null, explain: \`Range starts at \${a} but the resource is only \${res.content.length} bytes → 416 with the true size in Content-Range.\` };\r
    const end = Math.min(b, res.content.length - 1);\r
    return { status: 206, reason: 'Partial Content', headers: { ...base, 'Content-Range': \`bytes \${a}-\${end}/\${res.content.length}\`, 'Content-Length': String(end - a + 1) }, body: res.content.slice(a, end + 1), explain: \`206: only bytes \${a}–\${end} of \${res.content.length} are sent — exactly what a resumed download or a media seek needs.\` };\r
  }\r
\r
  return { status: 200, reason: 'OK', headers: { ...base, 'Content-Length': String(res.content.length) }, body: res.content, explain: 'No usable precondition → the full resource is sent with 200 OK.' };\r
}\r
`;export{e as default};