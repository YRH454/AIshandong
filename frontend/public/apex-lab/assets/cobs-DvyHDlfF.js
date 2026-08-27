var e=`// COBS — Consistent Overhead Byte Stuffing. A framing trick that solves a real serial/packet problem: you want\r
// a single byte value (0x00) to mean "end of frame," so a receiver can find frame boundaries in a stream by\r
// scanning for it. But your payload can contain 0x00 anywhere, which would create false boundaries. Classic\r
// escaping (like PPP/SLIP) replaces each troublesome byte with a two-byte escape sequence — cheap on average\r
// but the worst case DOUBLES the data, so you can't bound your buffers. COBS instead removes EVERY zero from the\r
// payload with a guaranteed tiny, predictable overhead: exactly 1 byte for every 254 bytes of payload, plus 1 —\r
// never more, no matter what the data is. The idea: chop the data into runs separated by zero bytes; prefix each\r
// run with a "code" byte holding the distance to the next zero (or end). A zero byte is never emitted — its\r
// position is encoded in the code byte instead — so the only 0x00 in the whole stream is the frame delimiter you\r
// append yourself. Runs longer than 254 use a code of 0xFF (254 data bytes, no implied trailing zero) and\r
// continue. Decoding is the mirror: read a code c, copy c−1 bytes, then (unless c==0xFF or it's the last group)\r
// emit one zero. Used in packet radio, microcontroller UART protocols, and anywhere you frame a byte stream.\r
// Reference: Cheshire & Baker, "Consistent Overhead Byte Stuffing" (IEEE/ACM ToN, 1999).\r
\r
/** Encode: produce a zero-free byte sequence. Append a 0x00 to it to delimit the frame on the wire. */\r
export function encode(data: number[]): number[] {\r
  const out: number[] = [];\r
  let codeIdx = 0;     // index of the current code byte (a placeholder we backfill)\r
  out.push(0);         // placeholder for the first code byte\r
  let code = 1;        // 1 + number of non-zero bytes seen in the current run\r
\r
  for (const b of data) {\r
    if (b === 0) {\r
      out[codeIdx] = code;   // close this run; the zero is implied, not written\r
      codeIdx = out.length; out.push(0);\r
      code = 1;\r
    } else {\r
      out.push(b);\r
      code++;\r
      if (code === 0xff) {   // a full run of 254 non-zero bytes: close it with 0xFF, no implied zero\r
        out[codeIdx] = code;\r
        codeIdx = out.length; out.push(0);\r
        code = 1;\r
      }\r
    }\r
  }\r
  out[codeIdx] = code;       // final code byte\r
  return out;\r
}\r
\r
/** Decode a COBS block (the bytes BEFORE the 0x00 delimiter) back to the original payload. */\r
export function decode(enc: number[]): number[] {\r
  const out: number[] = [];\r
  let i = 0;\r
  while (i < enc.length) {\r
    const code = enc[i++];\r
    if (code === 0) break;   // a real zero here would be the delimiter / malformed — stop\r
    for (let j = 1; j < code && i < enc.length; j++) out.push(enc[i++]);\r
    if (code < 0xff && i < enc.length) out.push(0); // implied zero between runs, but not after the last\r
  }\r
  return out;\r
}\r
\r
/** Worst-case COBS overhead for a payload of n bytes: floor(n/254)+1 bytes (plus the frame's trailing delimiter). */\r
export const overhead = (n: number): number => Math.floor(n / 254) + 1;\r
`;export{e as default};