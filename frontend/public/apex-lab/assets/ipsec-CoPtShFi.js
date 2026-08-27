var e=`// IPsec ESP (RFC 4303) — how a VPN encrypts and authenticates IP packets, in two modes. ESP wraps a\r
// packet with a header (SPI + sequence number), encrypts a payload, appends an integrity tag (ICV),\r
// and the receiver uses the SPI to look up the Security Association (SA) — the agreed key + algorithm —\r
// to undo it. The two modes differ in WHAT is protected and whether a new IP header is added:\r
//   • TRANSPORT mode (host↔host): encrypts just the upper-layer payload; the ORIGINAL IP header stays\r
//     in the clear (its protocol becomes 50 = ESP). Endpoints see who's talking, just not what's said.\r
//   • TUNNEL mode (gateway↔gateway, the classic VPN): encrypts the ENTIRE original IP packet — addresses\r
//     and all — and prepends a NEW outer IP header between the gateways. On the wire only the gateway\r
//     IPs show; the real source/destination are hidden inside the ciphertext.\r
// Honest crypto: the encrypted region is shown as opaque (we never invent plaintext bytes). Tested.\r
\r
export type Mode = 'transport' | 'tunnel';\r
\r
export interface SA { spi: number; peer: string; cipher: string } // a Security Association (one direction)\r
export type SADB = Record<number, SA>;\r
\r
export interface Layer { label: string; detail: string; encrypted: boolean }\r
\r
export interface EspPacket {\r
  mode: Mode;\r
  layers: Layer[]; // outer → inner, for the anatomy view\r
  observerSees: { src: string; dst: string }; // the IP header an on-path eavesdropper reads\r
  originalHidden: boolean; // are the real endpoints concealed?\r
  protects: string;\r
  nextHeader: string; // ESP trailer's Next Header field\r
  overheadBytes: number;\r
}\r
\r
export interface Endpoints { origSrc: string; origDst: string; gwSrc: string; gwDst: string }\r
\r
/** Build the ESP-protected packet for a mode. Encrypted layers are opaque — no plaintext is fabricated. */\r
export function encapsulate(mode: Mode, spi: number, seq: number, ep: Endpoints): EspPacket {\r
  const espHeader: Layer = { label: 'ESP header', detail: \`SPI 0x\${spi.toString(16).padStart(8, '0')} · seq \${seq}\`, encrypted: false };\r
  const icv: Layer = { label: 'ICV (auth tag)', detail: '16-byte integrity tag over the packet — opaque', encrypted: false };\r
\r
  if (mode === 'transport') {\r
    return {\r
      mode,\r
      layers: [\r
        { label: 'IP header (original)', detail: \`\${ep.origSrc} → \${ep.origDst} · proto 50 (ESP)\`, encrypted: false },\r
        espHeader,\r
        { label: 'encrypted: payload + ESP trailer', detail: 'the TCP/UDP payload, padding, pad-length, next-header = 6 (TCP) — ciphertext', encrypted: true },\r
        icv,\r
      ],\r
      observerSees: { src: ep.origSrc, dst: ep.origDst }, // original IP header is in the clear\r
      originalHidden: false,\r
      protects: 'the upper-layer payload only; the original IP header (who is talking) is exposed.',\r
      nextHeader: 'TCP (6)',\r
      overheadBytes: 8 /*ESP hdr*/ + 16 /*ICV*/ + 4 /*trailer*/,\r
    };\r
  }\r
  return {\r
    mode,\r
    layers: [\r
      { label: 'IP header (NEW outer)', detail: \`\${ep.gwSrc} → \${ep.gwDst} · proto 50 (ESP)\`, encrypted: false },\r
      espHeader,\r
      { label: 'encrypted: entire original IP packet + ESP trailer', detail: \`the whole inner packet (\${ep.origSrc} → \${ep.origDst} + payload), padding, next-header = 4 (IPv4) — ciphertext\`, encrypted: true },\r
      icv,\r
    ],\r
    observerSees: { src: ep.gwSrc, dst: ep.gwDst }, // only the gateways are visible\r
    originalHidden: true,\r
    protects: 'the ENTIRE original IP packet, including the real source and destination addresses.',\r
    nextHeader: 'IPv4 (4)',\r
    overheadBytes: 20 /*new IP hdr*/ + 8 /*ESP hdr*/ + 16 /*ICV*/ + 4 /*trailer*/,\r
  };\r
}\r
\r
/** The receiver demultiplexes an arriving ESP packet to its SA using the SPI (RFC 4303 §2.1). */\r
export function demux(sadb: SADB, spi: number): SA | null {\r
  return sadb[spi] ?? null;\r
}\r
`;export{e as default};