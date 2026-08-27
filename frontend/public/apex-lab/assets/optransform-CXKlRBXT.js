var e=`// Operational Transformation (OT) — how Google Docs (and Etherpad, and old Google Wave) let many people type\r
// in the same document at once without clobbering each other. The problem: two users act on the SAME document\r
// concurrently, each against their own local copy. If Alice inserts 'X' at position 2 and Bob deletes position\r
// 1 at the "same time," you can't just replay both operations everywhere — Bob's delete shifts everything after\r
// it, so Alice's "position 2" means something different once Bob's edit lands. OT's answer: before applying a\r
// remote operation, TRANSFORM it against the concurrent operations already applied locally, adjusting its\r
// indices so it still means the right thing. The correctness bar is convergence: no matter what order two\r
// sites receive the two operations, transforming appropriately must land both on the SAME final document. That\r
// property is called TP1: apply(apply(doc, a), transform(b, a)) == apply(apply(doc, b), transform(a, b)). This\r
// models character-wise insert/delete OT with site-id tie-breaking. Reference: Ellis & Gibbs (1989); the\r
// Jupiter/Google Wave OT model.\r
\r
export type Op =\r
  | { type: 'ins'; pos: number; ch: string; site: number }\r
  | { type: 'del'; pos: number; site: number }\r
  | { type: 'noop' };\r
\r
export function apply(doc: string, op: Op): string {\r
  if (op.type === 'noop') return doc;\r
  if (op.type === 'ins') return doc.slice(0, op.pos) + op.ch + doc.slice(op.pos);\r
  return doc.slice(0, op.pos) + doc.slice(op.pos + 1); // del\r
}\r
\r
/** Transform \`op\` so it applies correctly AFTER \`against\` has already been applied to the same base document. */\r
export function transform(op: Op, against: Op): Op {\r
  if (op.type === 'noop' || against.type === 'noop') return op;\r
\r
  if (op.type === 'ins' && against.type === 'ins') {\r
    // an earlier (or tie-broken-earlier) insert pushes this one right\r
    if (op.pos < against.pos || (op.pos === against.pos && op.site < against.site)) return op;\r
    return { ...op, pos: op.pos + 1 };\r
  }\r
  if (op.type === 'ins' && against.type === 'del') {\r
    // a deletion before this insert shifts it left\r
    return op.pos > against.pos ? { ...op, pos: op.pos - 1 } : op;\r
  }\r
  if (op.type === 'del' && against.type === 'ins') {\r
    // an insertion at or before this delete shifts it right\r
    return op.pos >= against.pos ? { ...op, pos: op.pos + 1 } : op;\r
  }\r
  // del vs del\r
  if (op.pos < against.pos) return op;\r
  if (op.pos > against.pos) return { ...op, pos: op.pos - 1 };\r
  return { type: 'noop' }; // both deleted the same character → this one becomes a no-op\r
}\r
\r
/** Does the TP1 convergence property hold for this base doc and concurrent op pair? */\r
export function converges(doc: string, a: Op, b: Op): { left: string; right: string; ok: boolean } {\r
  const left = apply(apply(doc, a), transform(b, a));  // site that saw a first\r
  const right = apply(apply(doc, b), transform(a, b)); // site that saw b first\r
  return { left, right, ok: left === right };\r
}\r
\r
/** What the naive (no-transform) approach would produce — to show why OT is needed. */\r
export function naive(doc: string, a: Op, b: Op): { left: string; right: string; ok: boolean } {\r
  const left = apply(apply(doc, a), b);\r
  const right = apply(apply(doc, b), a);\r
  return { left, right, ok: left === right };\r
}\r
`;export{e as default};