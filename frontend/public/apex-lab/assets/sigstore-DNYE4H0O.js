var e=`// Sigstore keyless signing — how you verify a release nobody kept a signing key for. Instead of a long-lived private\r
// key, the signer uses an EPHEMERAL keypair; it proves its identity to Fulcio over OIDC (e.g. a specific GitHub Actions\r
// workflow), and Fulcio issues a short-lived (~10 min) X.509 cert binding the ephemeral public key to that identity;\r
// the signature and cert are logged in Rekor, a transparency log, and the key is thrown away. The non-obvious part is\r
// verification: by the time anyone checks, the cert has long expired, so its validity can't come from the cert — it\r
// comes from Rekor's signed timestamp, which proves the signature was made inside the cert's 10-minute window. So\r
// identity replaces key custody, and the log replaces cert validity. This models the verification decision.\r
\r
export interface Bundle {\r
  sigValid: boolean;        // the signature verifies against the cert's public key\r
  identityMatches: boolean; // the cert's OIDC identity equals the signer you expect\r
  inRekor: boolean;         // the signature+cert is present in the Rekor transparency log (with a timestamp)\r
}\r
\r
export type Reject = 'sig' | 'identity' | 'log' | null;\r
export interface Result { ok: boolean; reject: Reject; reason: string }\r
\r
// Verify in order: the signature must check out, the identity must be the one you trust, and the entry must be in the\r
// log (the only thing that proves the now-expired cert was valid when it signed).\r
export function verifyBundle(b: Bundle): Result {\r
  if (!b.sigValid) {\r
    return { ok: false, reject: 'sig', reason: 'The signature doesn’t verify against the certificate’s public key — the artifact was altered or the signature is forged.' };\r
  }\r
  if (!b.identityMatches) {\r
    return { ok: false, reject: 'identity', reason: 'The signature is valid, but the certificate’s OIDC identity isn’t the signer you trust — a different workflow or account signed it. Keyless security IS the identity check; skip it and any Sigstore user can sign anything.' };\r
  }\r
  if (!b.inRekor) {\r
    return { ok: false, reject: 'log', reason: 'Valid signature from the right identity, but there’s no Rekor entry. The certificate expired long ago, so without the log’s signed timestamp proving the signature was made during its 10-minute window, you can’t trust it was ever legitimately issued.' };\r
  }\r
  return { ok: true, reject: null, reason: 'Verified: a valid signature, from the expected identity, with a Rekor timestamp inside the certificate’s validity window — even though nobody kept a key and the cert is long expired.' };\r
}\r
`;export{e as default};