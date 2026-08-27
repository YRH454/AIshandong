var e=`// Gorilla compression — how monitoring systems (Facebook's Gorilla, then Prometheus, InfluxDB, TimescaleDB)\r
// store billions of (timestamp, value) points in a fraction of the space. Two observations about real metrics:\r
// (1) timestamps are almost perfectly REGULAR — a data point every 60s — so instead of storing each timestamp,\r
// store the delta, and then the DELTA-OF-DELTA (how much the interval changed). For a steady stream that's 0,\r
// which encodes as a single bit. (2) consecutive VALUES are usually close, so XOR each double with the previous\r
// one: identical values XOR to all-zeros (one bit), and similar values XOR to a small run of bits in the middle\r
// that you can store with just its leading/trailing zero counts. Together this squeezes the typical 128 bits\r
// per sample (a 64-bit time + 64-bit double) down to ~1.4 bytes on real data — often 10× smaller. This file\r
// implements the real bit-level scheme and round-trips it. Reference: Pelkonen et al., "Gorilla: A Fast,\r
// Scalable, In-Memory Time Series Database" (VLDB 2015).\r
\r
// ---- bit stream (one bit per array slot; the COUNT is the compressed size) ----\r
class BitW {\r
  bits: number[] = [];\r
  put(bit: number) { this.bits.push(bit & 1); }\r
  putN(val: number, n: number) { const u = ((val % 2 ** n) + 2 ** n) % 2 ** n; for (let i = n - 1; i >= 0; i--) this.put(Math.floor(u / 2 ** i) & 1); }\r
  putBig(val: bigint, n: number) { for (let i = BigInt(n - 1); i >= 0n; i--) this.put(Number((val >> i) & 1n)); }\r
}\r
class BitR {\r
  i = 0;\r
  constructor(public bits: number[]) {}\r
  get() { return this.bits[this.i++]; }\r
  getN(n: number) { let v = 0; for (let k = 0; k < n; k++) v = v * 2 + this.bits[this.i++]; return v; }\r
  getSigned(n: number) { const v = this.getN(n); return v >= 2 ** (n - 1) ? v - 2 ** n : v; }\r
  getBig(n: number) { let v = 0n; for (let k = 0; k < n; k++) v = (v << 1n) | BigInt(this.bits[this.i++]); return v; }\r
}\r
\r
// double ↔ its 64-bit pattern\r
const _buf = new ArrayBuffer(8), _dv = new DataView(_buf);\r
const doubleBits = (x: number): bigint => { _dv.setFloat64(0, x); return _dv.getBigUint64(0); };\r
const bitsToDouble = (b: bigint): number => { _dv.setBigUint64(0, b); return _dv.getFloat64(0); };\r
const clz64 = (x: bigint): number => { if (x === 0n) return 64; let n = 0; for (let i = 63n; i >= 0n; i--) { if ((x >> i) & 1n) break; n++; } return n; };\r
const ctz64 = (x: bigint): number => { if (x === 0n) return 64; let n = 0; for (let i = 0n; i < 64n; i++) { if ((x >> i) & 1n) break; n++; } return n; };\r
\r
// delta-of-delta timestamp buckets: [tagBits, valueBits, halfRange]\r
const TS_BUCKETS: [number[], number, number][] = [\r
  [[1, 0], 7, 64],    // '10'  + 7 bits\r
  [[1, 1, 0], 9, 256],   // '110' + 9 bits\r
  [[1, 1, 1, 0], 12, 2048],  // '1110'+ 12 bits\r
];\r
\r
export interface Encoded { bits: number[]; count: number }\r
\r
export function encode(samples: { t: number; v: number }[]): Encoded {\r
  const w = new BitW();\r
  if (samples.length === 0) return { bits: [], count: 0 };\r
  // header: first timestamp (64) and first value (64), full\r
  w.putBig(BigInt(samples[0].t), 64);\r
  w.putBig(doubleBits(samples[0].v), 64);\r
  let prevDelta = 0, prevLead = -1, prevTrail = -1;\r
  for (let i = 1; i < samples.length; i++) {\r
    // --- timestamp: delta of delta ---\r
    const delta = samples[i].t - samples[i - 1].t;\r
    if (i === 1) { w.putN(delta, 32); prevDelta = delta; }        // first delta, full\r
    else {\r
      const dod = delta - prevDelta; prevDelta = delta;\r
      if (dod === 0) w.put(0);\r
      else {\r
        let done = false;\r
        for (const [tag, vbits, half] of TS_BUCKETS) {\r
          if (dod >= -half && dod < half) { tag.forEach((b) => w.put(b)); w.putN(dod, vbits); done = true; break; }\r
        }\r
        if (!done) { w.put(1); w.put(1); w.put(1); w.put(1); w.putN(dod, 32); } // '1111' + 32\r
      }\r
    }\r
    // --- value: XOR with previous ---\r
    const x = doubleBits(samples[i].v) ^ doubleBits(samples[i - 1].v);\r
    if (x === 0n) w.put(0);\r
    else {\r
      w.put(1);\r
      const lead = Math.min(clz64(x), 31), trail = ctz64(x);\r
      if (prevLead >= 0 && lead >= prevLead && trail >= prevTrail) {\r
        w.put(0); // reuse the previous window\r
        const len = 64 - prevLead - prevTrail;\r
        w.putBig((x >> BigInt(prevTrail)) & ((1n << BigInt(len)) - 1n), len);\r
      } else {\r
        w.put(1);\r
        const len = 64 - lead - trail;\r
        w.putN(lead, 5); w.putN(len - 1, 6);\r
        w.putBig((x >> BigInt(trail)) & ((1n << BigInt(len)) - 1n), len);\r
        prevLead = lead; prevTrail = trail;\r
      }\r
    }\r
  }\r
  return { bits: w.bits, count: w.bits.length };\r
}\r
\r
export function decode(enc: Encoded, n: number): { t: number; v: number }[] {\r
  if (n === 0) return [];\r
  const r = new BitR(enc.bits);\r
  const out: { t: number; v: number }[] = [];\r
  let t = Number(r.getBig(64));\r
  let vb = r.getBig(64);\r
  out.push({ t, v: bitsToDouble(vb) });\r
  let prevDelta = 0, prevLead = -1, prevTrail = -1;\r
  for (let i = 1; i < n; i++) {\r
    if (i === 1) { prevDelta = r.getSigned(32); t += prevDelta; }\r
    else {\r
      let dod: number;\r
      if (r.get() === 0) dod = 0;\r
      else if (r.get() === 0) dod = r.getSigned(7);\r
      else if (r.get() === 0) dod = r.getSigned(9);\r
      else if (r.get() === 0) dod = r.getSigned(12);\r
      else dod = r.getSigned(32);\r
      prevDelta += dod; t += prevDelta;\r
    }\r
    // value\r
    if (r.get() === 0) { /* xor 0 → same value */ }\r
    else {\r
      let lead: number, len: number;\r
      if (r.get() === 0) { lead = prevLead; len = 64 - prevLead - prevTrail; }\r
      else { lead = r.getN(5); len = r.getN(6) + 1; prevLead = lead; prevTrail = 64 - lead - len; }\r
      const meaningful = r.getBig(len);\r
      const x = meaningful << BigInt(prevTrail);\r
      vb = vb ^ x;\r
    }\r
    out.push({ t, v: bitsToDouble(vb) });\r
  }\r
  return out;\r
}\r
\r
/** Compressed bits per sample vs the naive 128 (64-bit time + 64-bit double). */\r
export function ratio(samples: { t: number; v: number }[]): { bits: number; perSample: number; naivePerSample: number; factor: number } {\r
  const enc = encode(samples);\r
  const perSample = enc.count / samples.length;\r
  return { bits: enc.count, perSample, naivePerSample: 128, factor: 128 / perSample };\r
}\r
`;export{e as default};