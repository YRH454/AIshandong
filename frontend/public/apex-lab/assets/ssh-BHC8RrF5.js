var e=`// SSH transport (RFC 4253), as a flow you can step through. The handshake builds an\r
// encrypted, authenticated channel BEFORE you ever send a password: exchange version\r
// banners, negotiate algorithms (KEXINIT), run a Diffie–Hellman/ECDH key exchange in\r
// which the server signs the transcript with its HOST KEY (proving identity), then\r
// NEWKEYS flips encryption on — everything after is opaque. Only then comes user auth\r
// and the multiplexed channels (shell, exec, sftp, port-forward). Plus the host-key\r
// trust-on-first-use check that catches a man-in-the-middle. Pure model (tested).\r
\r
export type Enc = 'plaintext' | 'encrypted';\r
export type Phase = 'setup' | 'kex' | 'auth' | 'channel';\r
\r
export interface SshStep { n: number; phase: Phase; from: string; to: string; msg: string; enc: Enc; note: string }\r
\r
export function handshake(): SshStep[] {\r
  const steps: Omit<SshStep, 'enc'>[] = [\r
    { n: 1, phase: 'setup', from: 'client', to: 'server', msg: 'TCP connect :22', note: 'A plain TCP connection — nothing is encrypted yet.' },\r
    { n: 2, phase: 'setup', from: 'both', to: 'both', msg: 'version exchange', note: 'Each side sends an identification banner like “SSH-2.0-OpenSSH_9.6”, in the clear.' },\r
    { n: 3, phase: 'kex', from: 'both', to: 'both', msg: 'KEXINIT', note: 'Both list the key-exchange, host-key, cipher and MAC algorithms they support; the best mutual choice wins.' },\r
    { n: 4, phase: 'kex', from: 'both', to: 'both', msg: 'KEX (ECDH) + host-key signature', note: 'Ephemeral ECDH gives a shared secret; the server SIGNS the exchange hash with its host key, proving it owns the identity — this is what the fingerprint check verifies.' },\r
    { n: 5, phase: 'kex', from: 'both', to: 'both', msg: 'NEWKEYS', note: 'Both switch to the keys derived from the exchange. From here on every packet is encrypted and MAC’d — opaque on the wire.' },\r
    { n: 6, phase: 'auth', from: 'client', to: 'server', msg: 'SERVICE_REQUEST ssh-userauth', note: 'Now, inside the encrypted tunnel, the client asks to authenticate. Your password (if used) never traverses the network in the clear.' },\r
    { n: 7, phase: 'auth', from: 'client', to: 'server', msg: 'USERAUTH (publickey / password)', note: 'Public-key auth signs a challenge with your private key; the server checks it against authorized_keys. No secret is sent.' },\r
    { n: 8, phase: 'channel', from: 'client', to: 'server', msg: 'CHANNEL_OPEN (session) + shell/exec', note: 'One connection multiplexes many channels — an interactive shell, exec, sftp, and forwarded ports — all over the single encrypted transport.' },\r
  ];\r
  // encryption turns on at NEWKEYS (step 5): steps after it are encrypted\r
  return steps.map((s) => ({ ...s, enc: s.n >= 6 ? 'encrypted' : 'plaintext' }));\r
}\r
\r
export const firstEncrypted = (steps: SshStep[]): number => steps.findIndex((s) => s.enc === 'encrypted');\r
\r
export type HostKeyResult = 'tofu' | 'trusted' | 'changed';\r
\r
/** known_hosts check: no record → trust-on-first-use; match → trusted; mismatch →\r
 *  CHANGED (a possible man-in-the-middle — SSH refuses loudly). */\r
export function verifyHost(knownFp: string | null, presentedFp: string): HostKeyResult {\r
  if (knownFp === null) return 'tofu';\r
  return knownFp === presentedFp ? 'trusted' : 'changed';\r
}\r
`;export{e as default};