var e=`// Line coding — how a string of bits becomes an actual voltage waveform on the wire.\r
// The same bits look completely different under each scheme, and the differences are\r
// the whole point: self-clocking (is there a guaranteed transition to recover the\r
// clock from?), DC balance, and how many signal levels the receiver must distinguish.\r
//\r
// Conventions used (and cited):\r
//   Manchester  — IEEE 802.3: logic 0 = high→low mid-bit, logic 1 = low→high mid-bit.\r
//   Diff. Manch.— mandatory mid-bit transition; a transition at the START of a bit\r
//                 encodes 0, no start transition encodes 1.\r
//   NRZI        — transition at the bit boundary encodes 1, none encodes 0.\r
//   AMI         — 0 = zero volts; 1 = alternating +/− ("bipolar", DC-free).\r
// Each waveform is emitted at half-bit resolution (2 samples/bit) so they line up.\r
// Pure and tested against hand-worked vectors.\r
\r
export type Level = -1 | 0 | 1;\r
export type Bit = 0 | 1;\r
\r
export interface Encoding {\r
  id: string;\r
  name: string;\r
  levels: number;        // distinct signal levels the receiver must distinguish\r
  selfClocking: boolean; // guaranteed transition every bit → clock recoverable\r
  samples: Level[];      // 2 per bit\r
  note: string;\r
}\r
\r
const dup = (l: Level): Level[] => [l, l];\r
\r
/** NRZ-L: high for 1, low for 0. One level held for the whole bit. */\r
function nrzl(bits: Bit[]): Level[] {\r
  return bits.flatMap((b) => dup(b ? 1 : -1));\r
}\r
\r
/** NRZI: invert the level at the bit boundary for a 1, hold it for a 0. */\r
function nrzi(bits: Bit[]): Level[] {\r
  let level: Level = -1; // resting level before the first bit\r
  const out: Level[] = [];\r
  for (const b of bits) {\r
    if (b) level = (-level) as Level; // transition encodes 1\r
    out.push(...dup(level));\r
  }\r
  return out;\r
}\r
\r
/** Manchester (IEEE 802.3): 1 = low→high, 0 = high→low, transition at mid-bit. */\r
function manchester(bits: Bit[]): Level[] {\r
  return bits.flatMap((b) => (b ? [-1, 1] : [1, -1]) as Level[]);\r
}\r
\r
/** Differential Manchester: always a mid-bit transition; a start-of-bit transition encodes 0. */\r
function diffManchester(bits: Bit[]): Level[] {\r
  let level: Level = 1;\r
  const out: Level[] = [];\r
  for (const b of bits) {\r
    if (b === 0) level = (-level) as Level; // 0 → transition at the start of the bit\r
    out.push(level);\r
    level = (-level) as Level;              // mandatory mid-bit transition\r
    out.push(level);\r
  }\r
  return out;\r
}\r
\r
/** AMI (bipolar): 0 = 0 V; each 1 alternates +1 / −1, giving zero DC. */\r
function ami(bits: Bit[]): Level[] {\r
  let last: Level = -1; // so the first mark comes out +1\r
  const out: Level[] = [];\r
  for (const b of bits) {\r
    if (b === 0) out.push(...dup(0));\r
    else { last = (-last) as Level; out.push(...dup(last)); }\r
  }\r
  return out;\r
}\r
\r
export function encodeAll(bits: Bit[]): Encoding[] {\r
  return [\r
    { id: 'nrzl', name: 'NRZ-L', levels: 2, selfClocking: false, samples: nrzl(bits),\r
      note: 'simplest, but a long run of one value has no transitions — the receiver can lose the clock.' },\r
    { id: 'nrzi', name: 'NRZI', levels: 2, selfClocking: false, samples: nrzi(bits),\r
      note: 'encodes 1 as a transition; immune to polarity inversion, but long runs of 0 still starve the clock.' },\r
    { id: 'manchester', name: 'Manchester', levels: 2, selfClocking: true, samples: manchester(bits),\r
      note: 'a transition every bit → self-clocking and DC-free, at the cost of double the bandwidth (10BASE-T).' },\r
    { id: 'diff', name: 'Diff. Manchester', levels: 2, selfClocking: true, samples: diffManchester(bits),\r
      note: 'self-clocking and polarity-independent — it reads transitions, not absolute levels (Token Ring).' },\r
    { id: 'ami', name: 'AMI (bipolar)', levels: 3, selfClocking: false, samples: ami(bits),\r
      note: 'alternating marks keep the average voltage at zero; runs of 0 still carry no transitions (T1).' },\r
  ];\r
}\r
`;export{e as default};