var e=`// QPACK (RFC 9204) — HTTP/3's header compression, and why it isn't just HPACK. Both\r
// shrink headers with a STATIC table of well-known name/value pairs (a single index\r
// byte) plus a DYNAMIC table that learns repeated headers. HPACK's dynamic table\r
// must be processed strictly in order, which would re-introduce head-of-line\r
// blocking over QUIC's independent streams — so QPACK moves table updates onto their\r
// own encoder/decoder streams and lets each request reference only entries it knows\r
// have arrived. We model the static/dynamic/literal choice and the byte savings.\r
\r
export interface Header { name: string; value: string }\r
\r
// A subset of the QPACK static table (RFC 9204 Appendix A) with real indices.\r
export const STATIC_TABLE: { i: number; name: string; value: string }[] = [\r
  { i: 0, name: ':authority', value: '' },\r
  { i: 1, name: ':path', value: '/' },\r
  { i: 17, name: ':method', value: 'GET' },\r
  { i: 20, name: ':method', value: 'POST' },\r
  { i: 22, name: ':scheme', value: 'http' },\r
  { i: 23, name: ':scheme', value: 'https' },\r
  { i: 25, name: ':status', value: '200' },\r
  { i: 27, name: ':status', value: '404' },\r
  { i: 52, name: 'content-type', value: 'text/html; charset=utf-8' },\r
  { i: 29, name: 'accept', value: '*/*' },\r
];\r
\r
export type Repr = 'static' | 'dynamic' | 'literal';\r
export interface Encoded { header: Header; repr: Repr; index?: number; bytes: number }\r
\r
const rawSize = (h: Header) => h.name.length + h.value.length + 2; // uncompressed (name + value + framing)\r
const eq = (a: Header, b: { name: string; value: string }) => a.name === b.name && a.value === b.value;\r
\r
/** Encode a header list against the static table and an evolving dynamic table. */\r
export function encode(headers: Header[], dynamic: Header[] = []): { items: Encoded[]; compressed: number; raw: number } {\r
  const dyn = [...dynamic];\r
  const items: Encoded[] = headers.map((h) => {\r
    const s = STATIC_TABLE.find((e) => eq(h, e));\r
    if (s) return { header: h, repr: 'static', index: s.i, bytes: 1 }; // one index byte\r
    const d = dyn.findIndex((e) => eq(h, e));\r
    if (d >= 0) return { header: h, repr: 'dynamic', index: d, bytes: 1 };\r
    dyn.push({ ...h }); // first sighting → insert so the next request indexes it\r
    return { header: h, repr: 'literal', bytes: rawSize(h) };\r
  });\r
  return {\r
    items,\r
    compressed: items.reduce((s, it) => s + it.bytes, 0),\r
    raw: headers.reduce((s, h) => s + rawSize(h), 0),\r
  };\r
}\r
\r
/** The dynamic table after encoding (literals that were inserted). */\r
export function learn(headers: Header[], dynamic: Header[] = []): Header[] {\r
  const dyn = [...dynamic];\r
  for (const h of headers) {\r
    if (!STATIC_TABLE.find((e) => eq(h, e)) && !dyn.find((e) => eq(h, e))) dyn.push({ ...h });\r
  }\r
  return dyn;\r
}\r
`;export{e as default};