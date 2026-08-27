var e=`// MPLS label switching — forwarding by a short fixed-length label instead of a\r
// longest-prefix IP lookup at every hop. The ingress router (LER) classifies the\r
// packet into a forwarding-equivalence class and PUSHES a label; each core router\r
// (LSR) does one exact-match lookup in its label FIB and SWAPS the label for the next\r
// hop; the penultimate router POPS the label (penultimate-hop popping) so the egress\r
// does a single IP lookup. The label, not the destination, picks the path — which is\r
// what makes traffic-engineered tunnels and L3VPNs possible. Pure model (tested).\r
\r
export type Action = 'push' | 'swap' | 'pop' | 'ip';\r
\r
export interface Lsr {\r
  name: string;\r
  role: 'ingress' | 'core' | 'penultimate' | 'egress';\r
  // label FIB: incoming label → { outgoing label or 'pop', next hop }\r
  lfib: Record<number, { out: number | 'pop'; next: string }>;\r
}\r
\r
export interface Hop { router: string; action: Action; inLabel: number | null; outLabel: number | null; next: string }\r
\r
// A four-router LSP: PE1 (push) → P1 (swap) → P2 (penultimate pop) → PE2 (egress IP).\r
export const PATH: Lsr[] = [\r
  { name: 'PE1', role: 'ingress', lfib: { 0: { out: 100, next: 'P1' } } }, // 0 = "from IP, classify to FEC"\r
  { name: 'P1', role: 'core', lfib: { 100: { out: 200, next: 'P2' } } },\r
  { name: 'P2', role: 'penultimate', lfib: { 200: { out: 'pop', next: 'PE2' } } }, // PHP\r
  { name: 'PE2', role: 'egress', lfib: {} }, // does an IP lookup → CE\r
];\r
\r
/** Trace the label through the LSP. The ingress pushes; cores swap; the penultimate\r
 *  pops; the egress forwards by IP. */\r
export function journey(path: Lsr[] = PATH): Hop[] {\r
  const hops: Hop[] = [];\r
  let label: number | null = null; // the label currently on the packet\r
  for (const r of path) {\r
    if (r.role === 'egress') { hops.push({ router: r.name, action: 'ip', inLabel: label, outLabel: null, next: 'CE2' }); label = null; continue; }\r
    const key: number = label ?? 0;\r
    const e: { out: number | 'pop'; next: string } | undefined = r.lfib[key];\r
    if (!e) { hops.push({ router: r.name, action: 'ip', inLabel: label, outLabel: null, next: '?' }); continue; }\r
    const action: Action = r.role === 'ingress' ? 'push' : e.out === 'pop' ? 'pop' : 'swap';\r
    const outLabel: number | null = e.out === 'pop' ? null : e.out;\r
    hops.push({ router: r.name, action, inLabel: label, outLabel, next: e.next });\r
    label = outLabel;\r
  }\r
  return hops;\r
}\r
`;export{e as default};