var e=`// The TLS 1.3 full handshake (RFC 8446 §2), as a pure data model so a view can\r
// animate it honestly. The crucial truths this encodes: only ClientHello and\r
// ServerHello travel in the clear; from EncryptedExtensions onward the handshake\r
// is already encrypted under HANDSHAKE traffic keys; and once both Finished\r
// messages are exchanged, application data flows under APPLICATION traffic keys\r
// and is OPAQUE on the wire. We never invent decrypted plaintext.\r
\r
export type EncLevel = 'plaintext' | 'handshake' | 'application';\r
\r
export interface TlsMessage {\r
  id: string;\r
  flight: number; // 1 = client hello, 2 = server flight, 3 = client finished, 4 = app data\r
  from: 'client' | 'server';\r
  record: 'handshake' | 'change_cipher_spec' | 'application_data';\r
  name: string;\r
  enc: EncLevel;\r
  purpose: string;\r
  establishes?: string; // key-schedule milestone reached AFTER this message\r
}\r
\r
/** The ordered messages of a 1-RTT TLS 1.3 handshake, ending in application data. */\r
export function tls13Flow(): TlsMessage[] {\r
  return [\r
    {\r
      id: 'client-hello', flight: 1, from: 'client', record: 'handshake', name: 'ClientHello', enc: 'plaintext',\r
      purpose: 'Offers TLS 1.3, cipher suites, and a key_share — the client’s ephemeral (EC)DHE public key. Sent in the clear.',\r
    },\r
    {\r
      id: 'server-hello', flight: 2, from: 'server', record: 'handshake', name: 'ServerHello', enc: 'plaintext',\r
      purpose: 'Picks the cipher suite and returns the server’s key_share. Now both sides can derive the shared secret.',\r
      establishes: 'Handshake secret → client/server handshake traffic keys (the rest of the handshake is now encrypted)',\r
    },\r
    {\r
      id: 'change-cipher-spec', flight: 2, from: 'server', record: 'change_cipher_spec', name: 'ChangeCipherSpec', enc: 'plaintext',\r
      purpose: 'A dummy record kept only for middlebox compatibility — it carries no security meaning in TLS 1.3.',\r
    },\r
    {\r
      id: 'encrypted-extensions', flight: 2, from: 'server', record: 'handshake', name: 'EncryptedExtensions', enc: 'handshake',\r
      purpose: 'The remaining server hello parameters (ALPN, etc.) — the first message protected by the handshake keys.',\r
    },\r
    {\r
      id: 'certificate', flight: 2, from: 'server', record: 'handshake', name: 'Certificate', enc: 'handshake',\r
      purpose: 'The server’s X.509 certificate chain, encrypted (in TLS 1.3 the certificate is no longer sent in the clear).',\r
    },\r
    {\r
      id: 'certificate-verify', flight: 2, from: 'server', record: 'handshake', name: 'CertificateVerify', enc: 'handshake',\r
      purpose: 'A signature over the handshake transcript with the certificate’s private key — proves the server owns it.',\r
    },\r
    {\r
      id: 'server-finished', flight: 2, from: 'server', record: 'handshake', name: 'Finished', enc: 'handshake',\r
      purpose: 'An HMAC over the whole transcript so far — proves the server’s handshake keys are correct and untampered.',\r
    },\r
    {\r
      id: 'client-finished', flight: 3, from: 'client', record: 'handshake', name: 'Finished', enc: 'handshake',\r
      purpose: 'The client’s transcript HMAC, completing the handshake. Both sides have now authenticated the key exchange.',\r
      establishes: 'Master secret → application traffic keys (application data now flows encrypted)',\r
    },\r
    {\r
      id: 'app-data', flight: 4, from: 'client', record: 'application_data', name: 'Application Data', enc: 'application',\r
      purpose: 'HTTP, etc., under the application traffic keys. On the wire it is an opaque record: type 23, length, ciphertext + tag. Apex never invents the plaintext.',\r
    },\r
  ];\r
}\r
\r
/** Index of the first message that is encrypted (under handshake keys). */\r
export function firstEncryptedIndex(flow: TlsMessage[]): number {\r
  return flow.findIndex((m) => m.enc !== 'plaintext');\r
}\r
\r
/** The encryption level in effect *while sending* the message at \`index\`. */\r
export function levelAt(flow: TlsMessage[], index: number): EncLevel {\r
  return flow[index]?.enc ?? 'plaintext';\r
}\r
`;export{e as default};