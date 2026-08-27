var e=`// X3DH — Signal's Extended Triple Diffie-Hellman, the ASYNCHRONOUS handshake that bootstraps a secure\r
// session even when the recipient is offline. Bob publishes a "prekey bundle" to the server ahead of\r
// time: his long-term Identity Key (IK), a Signed PreKey (SPK, signed by IK so it's authentic), and a\r
// batch of one-time PreKeys (OPK). Alice fetches the bundle, makes a fresh Ephemeral key (EK), and\r
// combines FOUR Diffie-Hellman results into one shared secret:\r
//   DH1 = DH(IK_A, SPK_B)  — ties Alice's identity to Bob's authenticated prekey (mutual auth)\r
//   DH2 = DH(EK_A, IK_B)   — ties Alice's ephemeral to Bob's identity\r
//   DH3 = DH(EK_A, SPK_B)  — forward secrecy from the ephemeral\r
//   DH4 = DH(EK_A, OPK_B)  — one-time, extra forward secrecy (dropped after use)\r
//   SK  = KDF(DH1 ‖ DH2 ‖ DH3 ‖ DH4)\r
// Bob, when he later comes online, recomputes the same four DHs with roles swapped and derives the\r
// SAME SK — no live round trip needed. We use a small prime-field DH (a teaching group, not Curve25519)\r
// with the real modular exponentiation and a real SHA-256 KDF, so both sides provably agree. Tested.\r
import { modpow } from './dh';\r
import { sha256 } from './sha256';\r
\r
export interface KeyPair { priv: bigint; pub: bigint }\r
export const keypair = (priv: bigint, p: bigint, g: bigint): KeyPair => ({ priv, pub: modpow(g, priv, p) });\r
\r
const enc = (s: string) => new TextEncoder().encode(s);\r
import { hex } from './bytes';\r
/** A real KDF over the concatenated DH outputs (SHA-256); returns the session key as hex. */\r
const kdf = (dh: bigint[]) => hex(sha256(enc('X3DH|' + dh.map((d) => d.toString()).join('|')))).slice(0, 32);\r
\r
export interface X3DHResult { dh: bigint[]; sk: string }\r
\r
/** Alice's side: she holds her IK + a fresh EK and Bob's PUBLIC bundle (IK_B, SPK_B, OPK_B). */\r
export function aliceDerive(p: bigint, ikA: KeyPair, ekA: KeyPair, ikBpub: bigint, spkBpub: bigint, opkBpub: bigint): X3DHResult {\r
  const dh = [\r
    modpow(spkBpub, ikA.priv, p), // DH1 = SPK_B ^ ik_a\r
    modpow(ikBpub, ekA.priv, p), //  DH2 = IK_B  ^ ek_a\r
    modpow(spkBpub, ekA.priv, p), // DH3 = SPK_B ^ ek_a\r
    modpow(opkBpub, ekA.priv, p), // DH4 = OPK_B ^ ek_a\r
  ];\r
  return { dh, sk: kdf(dh) };\r
}\r
\r
/** Bob's side (later): he holds his private IK/SPK/OPK and Alice's PUBLIC IK_A + EK_A. */\r
export function bobDerive(p: bigint, ikB: KeyPair, spkB: KeyPair, opkB: KeyPair, ikApub: bigint, ekApub: bigint): X3DHResult {\r
  const dh = [\r
    modpow(ikApub, spkB.priv, p), // DH1 = IK_A ^ spk_b  (= SPK_B ^ ik_a)\r
    modpow(ekApub, ikB.priv, p), //  DH2 = EK_A ^ ik_b\r
    modpow(ekApub, spkB.priv, p), // DH3 = EK_A ^ spk_b\r
    modpow(ekApub, opkB.priv, p), // DH4 = EK_A ^ opk_b\r
  ];\r
  return { dh, sk: kdf(dh) };\r
}\r
\r
export const LABELS = ['DH1 = IK_A · SPK_B', 'DH2 = EK_A · IK_B', 'DH3 = EK_A · SPK_B', 'DH4 = EK_A · OPK_B'];\r
export const WHY = ['mutual authentication', "binds Alice's ephemeral to Bob", 'forward secrecy', 'one-time forward secrecy'];\r
`;export{e as default};