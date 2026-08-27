var e=`// The one-time pad — the only cipher with PROVEN perfect secrecy, and the cautionary\r
// tale baked into its name. XOR the message with a truly random key as long as the\r
// message; the ciphertext is then statistically independent of the plaintext, so it\r
// leaks nothing — for ANY ciphertext and ANY target message there exists a key that\r
// connects them, so the attacker can rule nothing out. The catch: the key must be\r
// random, secret, and used exactly ONCE. Reuse it and C1⊕C2 = P1⊕P2 — the same\r
// nonce-reuse trap as CTR/GCM and ECDSA. Pure XOR; tested.\r
\r
export const xorBytes = (a: Uint8Array, b: Uint8Array): Uint8Array => {\r
  const n = Math.min(a.length, b.length);\r
  const out = new Uint8Array(n);\r
  for (let i = 0; i < n; i++) out[i] = a[i] ^ b[i];\r
  return out;\r
};\r
\r
/** Encrypt == decrypt: ciphertext = plaintext ⊕ key. The OTP requires a key AT LEAST as long as the\r
 *  message; xorBytes covers only the overlap, so a shorter key encrypts just a prefix (never do that). */\r
export const otpEncrypt = (plaintext: Uint8Array, key: Uint8Array): Uint8Array => xorBytes(plaintext, key);\r
\r
/** Perfect secrecy made concrete: the key that decrypts THIS ciphertext to ANY chosen\r
 *  message. Its existence is why a one-time-pad ciphertext reveals nothing. */\r
export const keyFor = (ciphertext: Uint8Array, target: Uint8Array): Uint8Array => xorBytes(ciphertext, target);\r
`;export{e as default};