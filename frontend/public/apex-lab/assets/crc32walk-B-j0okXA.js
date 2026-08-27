var e=`// CRC-32 (IEEE 802.3 / zip / PNG), computed the way the hardware does it: a 32-bit shift\r
// register that, for every input bit, shifts and conditionally XORs the generator\r
// polynomial. This is the reflected CRC-32 (poly 0xEDB88320, init 0xFFFFFFFF, final XOR\r
// 0xFFFFFFFF) used by Ethernet FCS, gzip, and PNG. A single flipped bit changes the\r
// output completely, which is how the receiver catches corruption. Pure and tested\r
// against the published check value CRC32("123456789") = 0xCBF43926.\r
\r
export const POLY = 0xedb88320; // the reflected IEEE 802.3 generator\r
\r
export interface BitStep { bit: number; lsbWasSet: boolean; reg: number }\r
\r
/** The eight shift-register steps for folding one byte into the running register. */\r
export function byteBitSteps(crcIn: number, byte: number): BitStep[] {\r
  let crc = (crcIn ^ byte) >>> 0;\r
  const steps: BitStep[] = [];\r
  for (let i = 0; i < 8; i++) {\r
    const lsb = (crc & 1) === 1;\r
    crc = lsb ? ((crc >>> 1) ^ POLY) >>> 0 : crc >>> 1;\r
    steps.push({ bit: i, lsbWasSet: lsb, reg: crc >>> 0 });\r
  }\r
  return steps;\r
}\r
\r
export interface ByteState { index: number; byte: number; reg: number }\r
\r
/** Process the whole input, recording the register after each byte. */\r
export function crc32Trace(data: number[]): { crc: number; bytes: ByteState[] } {\r
  let crc = 0xffffffff;\r
  const bytes: ByteState[] = [];\r
  data.forEach((byte, index) => {\r
    crc = (crc ^ byte) >>> 0;\r
    for (let i = 0; i < 8; i++) crc = (crc & 1) ? ((crc >>> 1) ^ POLY) >>> 0 : crc >>> 1;\r
    bytes.push({ index, byte, reg: crc >>> 0 });\r
  });\r
  return { crc: (crc ^ 0xffffffff) >>> 0, bytes };\r
}\r
\r
export const crc32 = (data: number[]): number => crc32Trace(data).crc;\r
\r
export const strBytes = (s: string): number[] => Array.from(new TextEncoder().encode(s));\r
export const toHex32 = (n: number): string => (n >>> 0).toString(16).padStart(8, '0');\r
`;export{e as default};