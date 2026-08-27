var e=`// Honeypot — a decoy with no legitimate use, so ANY interaction with it is malicious by definition. That gives it\r
// what a volume/threshold detector can't have: zero false positives. Contrast the two on the same traffic — a\r
// threshold IDS flags any source that makes enough connections (so a busy-but-benign host trips it), while the\r
// honeypot flags only sources that touch the decoy (which no legitimate host ever does). The honeypot's weakness is\r
// recall: a decoy that's too obviously fake gets fingerprinted and skipped. Modelled: both detectors + the trade-off.\r
\r
export type Conn = { src: string; dst: string; attack?: boolean }; // one connection attempt; \`attack\` = ground truth\r
\r
// Honeypot: every source that connects to the decoy host is flagged. Nothing legitimate should ever touch it.\r
export function honeypotDetect(conns: Conn[], decoy: string): string[] {\r
  return [...new Set(conns.filter((c) => c.dst === decoy).map((c) => c.src))];\r
}\r
\r
// Threshold IDS: any source making >= t connection attempts (across all hosts) is flagged as scanning.\r
export function idsDetect(conns: Conn[], t: number): string[] {\r
  const count = new Map<string, number>();\r
  for (const c of conns) count.set(c.src, (count.get(c.src) ?? 0) + 1);\r
  return [...count].filter(([, n]) => n >= t).map(([s]) => s);\r
}\r
\r
// Confusion matrix of an alert set against the ground-truth attack sources.\r
export function confusion(conns: Conn[], alerts: string[]): { tp: number; fp: number; fn: number } {\r
  const attackers = new Set(conns.filter((c) => c.attack).map((c) => c.src));\r
  const flagged = new Set(alerts);\r
  let tp = 0, fp = 0, fn = 0;\r
  for (const s of flagged) (attackers.has(s) ? tp++ : fp++);\r
  for (const s of attackers) if (!flagged.has(s)) fn++;\r
  return { tp, fp, fn };\r
}\r
\r
// Does the attacker actually probe the decoy? A convincing decoy (realism >= the attacker's fingerprinting skill) is\r
// touched; one that's too obviously fake is recognised and skipped — so the honeypot never sees it.\r
export function attackerProbesDecoy(realism: number, skill: number): boolean {\r
  return realism >= skill;\r
}\r
`;export{e as default};