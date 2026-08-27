var e=`// BB84 quantum key distribution (Bennett & Brassard, 1984) — agree on a secret key\r
// whose secrecy is guaranteed by physics, not computational hardness. Alice encodes\r
// each random bit in a random basis (rectilinear + or diagonal ×). Bob measures each\r
// in a random basis; when his basis matches Alice's he reads the bit, otherwise he\r
// gets a coin flip. They publicly compare BASES (not bits) and keep the matches — the\r
// "sifted" key. The magic: an eavesdropper must measure (collapsing the qubit) and\r
// resend, so when she guesses the basis wrong she injects errors. Comparing a few key\r
// bits reveals her ~25% error rate, and they abort. Deterministic given the random\r
// streams; tested.\r
\r
export type Basis = '+' | 'x';\r
export type Bit = 0 | 1;\r
\r
/** Measure a qubit prepared in \`prep\` basis in \`meas\` basis; matching → the bit,\r
 *  mismatched → a coin flip (the irreducible quantum randomness). */\r
export const measure = (bit: Bit, prep: Basis, meas: Basis, coin: number): Bit =>\r
  prep === meas ? bit : ((coin < 0.5 ? 0 : 1) as Bit);\r
\r
export interface Step { bit: Bit; aBasis: Basis; bBasis: Basis; bobBit: Bit; kept: boolean; error: boolean; eBasis?: Basis; eveBit?: Bit }\r
\r
export interface Run {\r
  steps: Step[];\r
  aliceKey: Bit[]; // sifted bits (where bases matched)\r
  bobKey: Bit[];\r
  sifted: number;\r
  errors: number;\r
  errorRate: number;\r
}\r
\r
export interface Eve { eBases: Basis[]; eCoins: number[] }\r
\r
export function run(aBits: Bit[], aBases: Basis[], bBases: Basis[], coins: number[], eve?: Eve): Run {\r
  const steps: Step[] = [];\r
  for (let i = 0; i < aBits.length; i++) {\r
    let preBit = aBits[i], preBasis = aBases[i];\r
    let eBasis: Basis | undefined, eveBit: Bit | undefined;\r
    if (eve) {\r
      eBasis = eve.eBases[i];\r
      eveBit = measure(aBits[i], aBases[i], eBasis, eve.eCoins[i]); // Eve measures…\r
      preBit = eveBit; preBasis = eBasis; // …and resends what she saw, in her basis\r
    }\r
    const bobBit = measure(preBit, preBasis, bBases[i], coins[i]);\r
    const kept = aBases[i] === bBases[i];\r
    const error = kept && bobBit !== aBits[i];\r
    steps.push({ bit: aBits[i], aBasis: aBases[i], bBasis: bBases[i], bobBit, kept, error, eBasis, eveBit });\r
  }\r
  const keptSteps = steps.filter((s) => s.kept);\r
  const errors = keptSteps.filter((s) => s.error).length;\r
  return {\r
    steps,\r
    aliceKey: keptSteps.map((s) => s.bit),\r
    bobKey: keptSteps.map((s) => s.bobBit),\r
    sifted: keptSteps.length,\r
    errors,\r
    errorRate: keptSteps.length ? errors / keptSteps.length : 0,\r
  };\r
}\r
`;export{e as default};