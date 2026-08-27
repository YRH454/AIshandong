var e=`// IEEE 802.1X — port-based network access control, the "you don't get on this LAN until you prove who\r
// you are" used by enterprise Wi-Fi (WPA2/3-Enterprise) and wired switch ports. Three roles: the\r
// SUPPLICANT (the device), the AUTHENTICATOR (the switch/AP guarding the port), and the AUTHENTICATION\r
// SERVER (RADIUS). Until authentication succeeds the port is UNAUTHORIZED — it passes only EAPOL frames,\r
// nothing else. The authenticator is a blind relay: it shuttles EAP messages between the supplicant\r
// (over EAPOL on the wire) and RADIUS (over the network), never seeing the actual credentials — only\r
// the RADIUS server decides. On EAP-Success the port flips to AUTHORIZED and normal traffic flows; on\r
// failure it stays shut. We model the message exchange, the EAPOL↔RADIUS translation, and the port\r
// state machine. Pure, tested.\r
\r
export type Outcome = 'accept' | 'reject';\r
export type Role = 'supplicant' | 'authenticator' | 'radius';\r
export type Proto = 'EAPOL' | 'RADIUS';\r
export type Port = 'unauthorized' | 'authorized';\r
\r
export interface Msg {\r
  n: number;\r
  from: Role;\r
  to: Role;\r
  proto: Proto; // EAPOL on the supplicant↔authenticator link, RADIUS on authenticator↔server\r
  label: string;\r
  port: Port; // the access port's state AFTER this message\r
  note: string;\r
}\r
\r
/** The full EAP exchange. The authenticator translates EAPOL↔RADIUS; the port stays unauthorized\r
 *  until EAP-Success (only on accept). */\r
export function exchange(outcome: Outcome): Msg[] {\r
  const ok = outcome === 'accept';\r
  const steps: Omit<Msg, 'n' | 'port'>[] = [\r
    { from: 'supplicant', to: 'authenticator', proto: 'EAPOL', label: 'EAPOL-Start', note: 'device asks to authenticate; the port is still blocked to everything but EAPOL.' },\r
    { from: 'authenticator', to: 'supplicant', proto: 'EAPOL', label: 'EAP-Request/Identity', note: 'authenticator asks who you are.' },\r
    { from: 'supplicant', to: 'authenticator', proto: 'EAPOL', label: 'EAP-Response/Identity', note: 'device sends its identity (e.g. user@corp).' },\r
    { from: 'authenticator', to: 'radius', proto: 'RADIUS', label: 'Access-Request (EAP)', note: 'authenticator wraps the EAP message in RADIUS and forwards it — it is just a relay.' },\r
    { from: 'radius', to: 'authenticator', proto: 'RADIUS', label: 'Access-Challenge (EAP method)', note: 'server starts an EAP method (TLS/PEAP); credentials are validated here, never at the switch.' },\r
    { from: 'authenticator', to: 'supplicant', proto: 'EAPOL', label: 'EAP-Request (method challenge)', note: 'relayed back to the device over EAPOL. Several method round-trips happen here.' },\r
    { from: 'supplicant', to: 'authenticator', proto: 'EAPOL', label: 'EAP-Response (method reply)', note: 'device proves its credential (certificate / password inside a TLS tunnel).' },\r
    { from: 'authenticator', to: 'radius', proto: 'RADIUS', label: 'Access-Request (EAP)', note: 'forwarded to the server for the verdict.' },\r
    ok\r
      ? { from: 'radius', to: 'authenticator', proto: 'RADIUS', label: 'Access-Accept (+ EAP-Success, keys)', note: 'server accepts and ships the session key (MSK) to the authenticator.' }\r
      : { from: 'radius', to: 'authenticator', proto: 'RADIUS', label: 'Access-Reject (+ EAP-Failure)', note: 'server rejects — bad credential.' },\r
    ok\r
      ? { from: 'authenticator', to: 'supplicant', proto: 'EAPOL', label: 'EAP-Success', note: 'port flips to AUTHORIZED; normal traffic now flows (WPA2-Enterprise then runs the 4-way handshake from the MSK).' }\r
      : { from: 'authenticator', to: 'supplicant', proto: 'EAPOL', label: 'EAP-Failure', note: 'port stays UNAUTHORIZED; the device is kept off the network.' },\r
  ];\r
  return steps.map((s, i) => ({\r
    ...s,\r
    n: i + 1,\r
    port: (ok && s.label === 'EAP-Success') || (ok && i === steps.length - 1) ? 'authorized' : 'unauthorized',\r
  }));\r
}\r
\r
/** Convenience: was the port opened? */\r
export const portAuthorized = (msgs: Msg[]): boolean => msgs[msgs.length - 1].port === 'authorized';\r
`;export{e as default};