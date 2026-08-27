var e=`// Distributed tracing — following one request as it fans out across services, and seeing where the time\r
// actually went. Each unit of work is a SPAN with a start, a duration, and a parent; spans sharing a\r
// trace id form a tree, and laying them out on a timeline gives the familiar WATERFALL. The key derived\r
// number is a span's SELF TIME: its own duration minus the time its children took — that's the work it\r
// did itself, and self-times across the whole tree partition the total request latency exactly, so a\r
// trace tells you precisely which service to optimize. The trace context (trace id + parent span id) is\r
// propagated across every network hop (W3C traceparent header) so the pieces can be stitched back into\r
// one tree. Reference: Sigelman et al., "Dapper" (Google 2010); the W3C Trace Context spec; OpenTelemetry.\r
\r
export interface Span { id: string; parent: string | null; service: string; op: string; start: number; duration: number }\r
export interface TraceInfo { spans: Span[]; total: number; depth: Record<string, number>; selfTime: Record<string, number>; byService: { service: string; ms: number }[]; root: Span }\r
\r
export function analyze(spans: Span[]): TraceInfo {\r
  const children: Record<string, Span[]> = {};\r
  for (const s of spans) if (s.parent) (children[s.parent] ??= []).push(s);\r
\r
  const root = spans.find((s) => s.parent === null)!;\r
  const depth: Record<string, number> = {};\r
  const setDepth = (s: Span, d: number) => { depth[s.id] = d; for (const c of children[s.id] ?? []) setDepth(c, d + 1); };\r
  setDepth(root, 0);\r
\r
  const selfTime: Record<string, number> = {};\r
  for (const s of spans) selfTime[s.id] = s.duration - (children[s.id] ?? []).reduce((a, c) => a + c.duration, 0);\r
\r
  const svc: Record<string, number> = {};\r
  for (const s of spans) svc[s.service] = (svc[s.service] ?? 0) + selfTime[s.id];\r
  const byService = Object.entries(svc).map(([service, ms]) => ({ service, ms })).sort((a, b) => b.ms - a.ms);\r
\r
  // ordered for a waterfall: pre-order DFS by start time\r
  const ordered: Span[] = [];\r
  const walk = (s: Span) => { ordered.push(s); for (const c of (children[s.id] ?? []).sort((a, b) => a.start - b.start)) walk(c); };\r
  walk(root);\r
\r
  return { spans: ordered, total: root.duration, depth, selfTime, byService, root };\r
}\r
`;export{e as default};