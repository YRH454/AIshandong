var e=`// Geohashing — encode a latitude/longitude into a short string so that nearby points share\r
// a prefix. The trick is interleaving: repeatedly halve the world, recording one bit per\r
// split — even bits halve longitude, odd bits halve latitude — then base32-encode the bit\r
// stream. A longer hash is a smaller box, and because each character refines the same\r
// nested grid, two locations close together agree on a leading prefix. That turns\r
// "find things near here" into a cheap prefix scan, which is why geohashes index spatial\r
// data in Redis, Elasticsearch, and many databases. Pure, tested against the canonical\r
// (42.6, -5.6) → "ezs42" vector.\r
\r
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'; // no a, i, l, o\r
\r
export function encode(lat: number, lon: number, precision = 5): string {\r
  let latR = [-90, 90], lonR = [-180, 180];\r
  let even = true, bit = 0, ch = 0;\r
  let hash = '';\r
  while (hash.length < precision) {\r
    if (even) {\r
      const mid = (lonR[0] + lonR[1]) / 2;\r
      if (lon >= mid) { ch |= 1 << (4 - bit); lonR = [mid, lonR[1]]; } else lonR = [lonR[0], mid];\r
    } else {\r
      const mid = (latR[0] + latR[1]) / 2;\r
      if (lat >= mid) { ch |= 1 << (4 - bit); latR = [mid, latR[1]]; } else latR = [latR[0], mid];\r
    }\r
    even = !even;\r
    if (bit < 4) bit++;\r
    else { hash += BASE32[ch]; bit = 0; ch = 0; }\r
  }\r
  return hash;\r
}\r
\r
export interface Box { latMin: number; latMax: number; lonMin: number; lonMax: number; lat: number; lon: number }\r
\r
/** Decode a geohash to its bounding box and centre. */\r
export function decode(hash: string): Box {\r
  let latR = [-90, 90], lonR = [-180, 180];\r
  let even = true;\r
  for (const c of hash) {\r
    const idx = BASE32.indexOf(c);\r
    for (let b = 4; b >= 0; b--) {\r
      const bit = (idx >> b) & 1;\r
      if (even) { const mid = (lonR[0] + lonR[1]) / 2; lonR = bit ? [mid, lonR[1]] : [lonR[0], mid]; }\r
      else { const mid = (latR[0] + latR[1]) / 2; latR = bit ? [mid, latR[1]] : [latR[0], mid]; }\r
      even = !even;\r
    }\r
  }\r
  return { latMin: latR[0], latMax: latR[1], lonMin: lonR[0], lonMax: lonR[1], lat: (latR[0] + latR[1]) / 2, lon: (lonR[0] + lonR[1]) / 2 };\r
}\r
\r
/** Length of the shared leading prefix of two geohashes (a proxy for proximity). */\r
export function commonPrefix(a: string, b: string): number {\r
  let n = 0;\r
  while (n < a.length && n < b.length && a[n] === b[n]) n++;\r
  return n;\r
}\r
`;export{e as default};