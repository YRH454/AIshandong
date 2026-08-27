var e=`// PBFT — Practical Byzantine Fault Tolerance (Castro & Liskov, 1999). Paxos and Raft\r
// tolerate nodes that crash; PBFT tolerates nodes that LIE — Byzantine replicas that send\r
// conflicting messages to different peers. The price is replication: to survive f Byzantine\r
// faults you need n ≥ 3f+1 replicas and quorums of 2f+1. Why 3f+1? A quorum of 2f+1 might\r
// include all f liars, leaving f+1 honest; any two quorums overlap in at least f+1 nodes, so\r
// at least one HONEST node is in both — that shared honest witness prevents two conflicting\r
// values from both being committed. Agreement runs in three phases (pre-prepare, prepare,\r
// commit), each needing a 2f+1 quorum. Pure model of the quorum math + phase progression.\r
\r
export interface Analysis {\r
  n: number;\r
  f: number;\r
  tolerant: boolean;       // n ≥ 3f+1\r
  quorum: number;          // 2f+1\r
  honest: number;          // n − f\r
  honestInQuorum: number;  // quorum − f (the honest floor inside any quorum)\r
  intersectionMin: number; // min overlap of two quorums = 2·quorum − n\r
  honestInIntersection: number; // intersectionMin − f\r
}\r
\r
export function analyze(n: number, f: number): Analysis {\r
  const quorum = 2 * f + 1;\r
  const intersectionMin = Math.max(0, 2 * quorum - n);\r
  return {\r
    n, f,\r
    tolerant: n >= 3 * f + 1,\r
    quorum,\r
    honest: n - f,\r
    honestInQuorum: quorum - f,\r
    intersectionMin,\r
    // floored: outside the tolerant regime (n > 4f+2) quorums needn't overlap, so this\r
    // figure is vacuous rather than negative\r
    honestInIntersection: Math.max(0, intersectionMin - f),\r
  };\r
}\r
\r
export interface Phase { name: string; needed: number; honestCanSend: number; reached: boolean }\r
export interface Run { phases: Phase[]; agreement: boolean; reason: string }\r
\r
/** Simulate the three quorum phases: only honest replicas reliably send matching messages,\r
 *  so each 2f+1 quorum is reachable iff there are at least 2f+1 honest replicas (n ≥ 3f+1). */\r
export function simulate(n: number, f: number): Run {\r
  const a = analyze(n, f);\r
  const phaseNames = ['pre-prepare', 'prepare', 'commit'];\r
  const phases: Phase[] = phaseNames.map((name) => ({\r
    name,\r
    needed: name === 'pre-prepare' ? 1 : a.quorum, // pre-prepare is the primary alone\r
    honestCanSend: a.honest,\r
    reached: name === 'pre-prepare' ? a.honest >= 1 : a.honest >= a.quorum,\r
  }));\r
  const agreement = a.tolerant && phases.every((p) => p.reached);\r
  return {\r
    phases,\r
    agreement,\r
    reason: agreement\r
      ? \`n=\${n} ≥ 3f+1=\${3 * f + 1}: every 2f+1 quorum has \${a.honest} honest replicas to draw on, and any two quorums share ≥\${a.honestInIntersection} honest node — safe.\`\r
      : \`n=\${n} < 3f+1=\${3 * f + 1}: only \${a.honest} honest replicas, fewer than the \${a.quorum} a quorum needs — the f liars can block or split agreement.\`,\r
  };\r
}\r
`;export{e as default};