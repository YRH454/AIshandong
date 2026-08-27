var e=`// More real encodings — the ones that quietly run the internet: protobuf
// varints, ASN.1/DER (every X.509 cert), punycode (and the IDN homograph trap),
// percent-encoding, and a classic hexdump. All genuine, all tested vs the specs.

// ---- Protobuf varint + ZigZag (developers.google.com/protocol-buffers/docs/encoding) ----

/** LEB128 base-128 varint: 7 bits per byte, high bit = "more bytes follow". */
export function varintEncode(value: bigint | number): number[] {
  let v = BigInt(value);
  if (v < 0n) throw new Error('varint is for non-negative integers (use ZigZag for signed)');
  const out: number[] = [];
  do {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) b |= 0x80;
    out.push(b);
  } while (v > 0n);
  return out;
}

export function varintDecode(bytes: number[]): { value: bigint; bytesRead: number } {
  let value = 0n, shift = 0n, i = 0;
  for (; i < bytes.length; i++) {
    value |= BigInt(bytes[i] & 0x7f) << shift;
    if (!(bytes[i] & 0x80)) { i++; break; }
    shift += 7n;
  }
  return { value, bytesRead: i };
}

/** ZigZag maps signed ints to unsigned so small magnitudes stay small: 0,-1,1,-2 → 0,1,2,3. */
export function zigzagEncode(n: bigint): bigint { return n < 0n ? (-n << 1n) - 1n : n << 1n; }
export function zigzagDecode(z: bigint): bigint { return z & 1n ? -((z + 1n) >> 1n) : z >> 1n; }

// ---- ASN.1 / DER (X.690) — Tag-Length-Value, the shape of every certificate ----

const DER_TAGS: Record<number, string> = {
  0x01: 'BOOLEAN', 0x02: 'INTEGER', 0x03: 'BIT STRING', 0x04: 'OCTET STRING', 0x05: 'NULL',
  0x06: 'OBJECT IDENTIFIER', 0x0a: 'ENUMERATED', 0x0c: 'UTF8String', 0x10: 'SEQUENCE', 0x11: 'SET',
  0x13: 'PrintableString', 0x16: 'IA5String', 0x17: 'UTCTime', 0x18: 'GeneralizedTime',
};

export interface Tlv {
  tag: number;
  tagName: string;
  constructed: boolean;
  cls: string; // universal | application | context | private
  length: number;
  headerLen: number;
  value: Uint8Array;
  children?: Tlv[];
}

/** Parse one DER TLV at \`off\`; recurse into constructed types. */
export function derParse(bytes: Uint8Array, off = 0): Tlv {
  const tag = bytes[off];
  const cls = ['universal', 'application', 'context', 'private'][(tag >> 6) & 3];
  const constructed = (tag & 0x20) !== 0;
  const tagNum = tag & 0x1f;
  let p = off + 1;
  let length = bytes[p++];
  if (length & 0x80) {
    const n = length & 0x7f;
    length = 0;
    for (let i = 0; i < n; i++) length = (length << 8) | bytes[p++];
  }
  const headerLen = p - off;
  const value = bytes.subarray(p, p + length);
  const node: Tlv = {
    tag, tagName: DER_TAGS[tagNum] ?? \`tag \${tagNum}\`, constructed, cls, length, headerLen, value,
  };
  if (constructed) {
    node.children = [];
    let c = p;
    while (c < p + length) {
      const child = derParse(bytes, c);
      node.children.push(child);
      c += child.headerLen + child.length;
    }
  }
  return node;
}

// ---- Punycode (RFC 3492) — how non-ASCII domains become xn--… ----------------

const BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INITIAL_BIAS = 72, INITIAL_N = 128, DELIM = 0x2d;

const digitToBasic = (d: number) => d + 22 + (d < 26 ? 75 : 0); // 0-25→a-z, 26-35→0-9
function basicToDigit(cp: number): number {
  if (cp - 48 < 10) return cp - 22;
  if (cp - 65 < 26) return cp - 65;
  if (cp - 97 < 26) return cp - 97;
  return BASE;
}
function adapt(delta: number, n: number, first: boolean): number {
  delta = first ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / n);
  let k = 0;
  while (delta > ((BASE - TMIN) * TMAX) >> 1) { delta = Math.floor(delta / (BASE - TMIN)); k += BASE; }
  return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW));
}

/** Encode a Unicode label to its punycode (without the xn-- prefix). */
export function punycodeEncode(input: string): string {
  const cps = [...input].map((c) => c.codePointAt(0)!);
  let n = INITIAL_N, delta = 0, bias = INITIAL_BIAS;
  const out: number[] = [];
  const basics = cps.filter((c) => c < 0x80);
  const b = basics.length;
  let h = b;
  for (const c of basics) out.push(c);
  if (b > 0) out.push(DELIM);
  while (h < cps.length) {
    let m = Infinity;
    for (const c of cps) if (c >= n && c < m) m = c;
    delta += (m - n) * (h + 1);
    n = m;
    for (const c of cps) {
      if (c < n) delta++;
      if (c === n) {
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
          if (q < t) break;
          out.push(digitToBasic(t + ((q - t) % (BASE - t))));
          q = Math.floor((q - t) / (BASE - t));
        }
        out.push(digitToBasic(q));
        bias = adapt(delta, h + 1, h === b);
        delta = 0; h++;
      }
    }
    delta++; n++;
  }
  return String.fromCharCode(...out);
}

/** Decode a punycode label (without xn--) back to Unicode. */
export function punycodeDecode(input: string): string {
  const out: number[] = [];
  let n = INITIAL_N, bias = INITIAL_BIAS, i = 0;
  const lastDelim = input.lastIndexOf('-');
  const basicPart = lastDelim >= 0 ? input.slice(0, lastDelim) : '';
  for (const ch of basicPart) out.push(ch.charCodeAt(0));
  let idx = lastDelim >= 0 ? lastDelim + 1 : 0;
  while (idx < input.length) {
    const oldi = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      const digit = basicToDigit(input.charCodeAt(idx++));
      i += digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
    }
    const len = out.length + 1;
    bias = adapt(i - oldi, len, oldi === 0);
    n += Math.floor(i / len);
    i %= len;
    out.splice(i, 0, n);
    i++;
  }
  return String.fromCodePoint(...out);
}

/** Convert a full domain to its IDNA ASCII (xn--) form, label by label. */
export function toAscii(domain: string): string {
  return domain.split('.').map((label) => {
    // eslint-disable-next-line no-control-regex
    return /[^\0-]/.test(label) ? 'xn--' + punycodeEncode(label) : label;
  }).join('.');
}

// ---- percent-encoding (RFC 3986) ---------------------------------------------

export function percentEncode(s: string): string {
  let out = '';
  for (const byte of new TextEncoder().encode(s)) {
    const ch = String.fromCharCode(byte);
    out += /[A-Za-z0-9\\-_.~]/.test(ch) ? ch : '%' + byte.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

// ---- hexdump (xxd-style) -----------------------------------------------------

export function hexdump(bytes: Uint8Array): string[] {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.subarray(i, i + 16);
    const hex = [...chunk].map((b, j) => b.toString(16).padStart(2, '0') + (j === 7 ? ' ' : '')).join(' ');
    const ascii = [...chunk].map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('');
    lines.push(\`\${i.toString(16).padStart(8, '0')}  \${hex.padEnd(49, ' ')} |\${ascii}|\`);
  }
  return lines;
}
`;export{e as default};