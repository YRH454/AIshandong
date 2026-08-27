var e=`// IDS/IPS — intrusion detection two ways, and the tradeoff between them. A SIGNATURE detector matches traffic\r
// against a database of known-attack patterns: precise on known attacks, blind to anything novel (no signature yet).\r
// An ANOMALY detector learns a baseline of "normal" and flags deviations: it can catch never-seen attacks, but it\r
// false-alarms on unusual-but-benign traffic and can miss a low-and-slow attack that stays under the threshold.\r
// (An IPS is the same detection sitting inline, blocking instead of just alerting.)\r
\r
export type Kind = 'normal' | 'known' | 'novel';\r
export type Event = { id: string; kind: Kind; desc: string; anomaly: number }; // anomaly score 0..1\r
\r
export const isAttack = (e: Event): boolean => e.kind !== 'normal';\r
\r
// Signature detection fires only on KNOWN attacks — the ones with an entry in the signature DB.\r
export const signatureFlags = (e: Event): boolean => e.kind === 'known';\r
\r
// Anomaly detection fires on anything scoring at or above the baseline threshold.\r
export const anomalyFlags = (e: Event, threshold: number): boolean => e.anomaly >= threshold;\r
\r
export type Outcome = 'true-positive' | 'false-negative' | 'false-positive' | 'true-negative';\r
export function outcome(flagged: boolean, attack: boolean): Outcome {\r
  if (flagged) return attack ? 'true-positive' : 'false-positive';\r
  return attack ? 'false-negative' : 'true-negative';\r
}\r
`;export{e as default};