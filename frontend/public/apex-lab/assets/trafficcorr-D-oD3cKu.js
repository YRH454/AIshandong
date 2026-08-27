var e=`// End-to-end traffic correlation — the attack that sets the ceiling on low-latency anonymity (Tor). An adversary who\r
// can OBSERVE traffic entering the network near the client AND leaving it near the destination doesn't need to break\r
// any encryption: the two flows carry the same shape over time (the same bursts and gaps), so a statistical\r
// correlation links them. This is why Tor cannot defend against a global passive adversary, and why the defense —\r
// constant-rate COVER TRAFFIC — costs bandwidth: pad every flow to a flat rate and the tell-tale shape disappears.\r
// (Danezis/Murdoch on Tor traffic analysis; the property mix networks buy with batching + delay.)\r
\r
// Pearson correlation of two equal-length series, in [-1, 1]. If either series has no variance (e.g. a constant,\r
// padded flow), there is no shape to match, so correlation is undefined — we report 0 (nothing to link on).\r
export function pearson(a: number[], b: number[]): number {\r
  const n = a.length;\r
  if (n === 0 || b.length !== n) return 0;\r
  const ma = a.reduce((s, x) => s + x, 0) / n;\r
  const mb = b.reduce((s, x) => s + x, 0) / n;\r
  let cov = 0, va = 0, vb = 0;\r
  for (let i = 0; i < n; i++) {\r
    const da = a[i] - ma, db = b[i] - mb;\r
    cov += da * db; va += da * da; vb += db * db;\r
  }\r
  if (va === 0 || vb === 0) return 0;\r
  return cov / Math.sqrt(va * vb);\r
}\r
\r
// Constant-rate cover traffic: send a fixed number of cells every slot regardless of the real payload, so every\r
// observer sees a flat line with no shape. \`rate\` defaults to the flow's peak, i.e. enough headroom to hide it.\r
export function constantRatePad(flow: number[], rate?: number): number[] {\r
  const r = rate ?? Math.max(1, ...flow);\r
  return flow.map(() => r);\r
}\r
\r
// The adversary links two observed flows when their correlation clears a threshold. Real Tor traffic-analysis papers\r
// achieve very high confidence; 0.8 is a reasonable illustrative bar.\r
export function links(entry: number[], exit: number[], threshold = 0.8): boolean {\r
  return pearson(entry, exit) >= threshold;\r
}\r
\r
// Given the target's entry flow and several candidate exit flows, the adversary's best guess is the most-correlated\r
// one. Returns its index and score (or -1 if nothing clears the threshold — the attack fails).\r
export function bestMatch(entry: number[], exits: number[][], threshold = 0.8): { index: number; score: number } {\r
  let index = -1, score = -Infinity;\r
  exits.forEach((e, i) => { const r = pearson(entry, e); if (r > score) { score = r; index = i; } });\r
  return score >= threshold ? { index, score } : { index: -1, score };\r
}\r
`;export{e as default};