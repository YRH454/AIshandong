var e=`// Remote attestation — how you trust code running on a machine you don't own. A TEE (Intel SGX/TDX, AMD SEV, a\r
// confidential VM) runs an enclave that the host OS and cloud operator can't read or tamper with. To convince a remote\r
// party of that, the CPU's security processor emits a QUOTE: a signed statement carrying a MEASUREMENT (a hash of the\r
// exact code/VM that was loaded) and the verifier's NONCE, under a key that chains to the hardware manufacturer's root.\r
// The relying party accepts only if the signature chains to the trusted vendor root (it's genuine TEE hardware, not an\r
// emulator), the measurement equals the code it expects (unmodified software), and the nonce matches its challenge\r
// (fresh, not a replayed old quote). Then — and only then — it releases its secret into the enclave. This models that\r
// three-step check.\r
\r
export interface Quote { sigChainsToVendorRoot: boolean; measurement: string; nonce: string }\r
\r
export type Reject = 'signature' | 'measurement' | 'nonce' | null;\r
export interface Result { ok: boolean; reject: Reject; reason: string }\r
\r
export function verifyQuote(q: Quote, expectedMeasurement: string, challenge: string): Result {\r
  if (!q.sigChainsToVendorRoot) {\r
    return { ok: false, reject: 'signature', reason: 'The quote’s signature doesn’t chain to the hardware vendor’s root, so this isn’t a genuine TEE — it could be an emulator or a spoofed report. Nothing else it claims can be believed.' };\r
  }\r
  if (q.measurement !== expectedMeasurement) {\r
    return { ok: false, reject: 'measurement', reason: \`Genuine hardware, but the measurement (\${q.measurement}) isn’t the code you expect (\${expectedMeasurement}) — the binary was modified or it’s a different image. Don’t send secrets to code you didn’t vet.\` };\r
  }\r
  if (q.nonce !== challenge) {\r
    return { ok: false, reject: 'nonce', reason: 'Right hardware and right code, but the nonce doesn’t match your challenge — this is a replayed old quote, not proof the enclave is live right now. An attacker could capture one good quote and reuse it.' };\r
  }\r
  return { ok: true, reject: null, reason: 'Genuine TEE, running exactly the expected code, answering this challenge freshly — so you can provision your secret into the enclave, trusting a machine you don’t control and an operator you don’t trust to stay out of it.' };\r
}\r
`;export{e as default};