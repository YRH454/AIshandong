var e=`// DNS rebinding — a browser attack that turns the same-origin policy against itself to reach services the\r
// attacker's server could never touch directly: your router's admin page, a cloud metadata endpoint\r
// (169.254.169.254), a dev server on localhost, an internal API. The trick abuses the gap between what the\r
// browser uses as a security boundary (the HOSTNAME/origin) and what actually carries the packets (the IP the\r
// hostname currently resolves to). The dance: (1) the victim opens http://evil.com, which resolves to the\r
// attacker's real IP and serves malicious JavaScript; the page's origin is "evil.com". (2) The attacker, who\r
// controls evil.com's DNS with a very short TTL, FLIPS the record to point at 127.0.0.1 (or an internal RFC1918\r
// address). (3) The JS waits for the TTL to lapse, then fetches http://evil.com/… again — the browser\r
// re-resolves and now sends the request to the LOCAL service, but because the hostname is still "evil.com" the\r
// same-origin policy lets the JS READ the response. The attacker's code is now talking to your internal network\r
// and exfiltrating what it finds. Defenses stack at three layers: block DNS answers that map public names to\r
// private IPs (resolver/browser "DNS rebinding protection"), pin the first resolved IP for the page's lifetime\r
// (DNS pinning), and validate the Host header on internal services so they reject "evil.com". This models the\r
// timeline and which defense stops it. Reference: OWASP DNS rebinding; Singularity of Origin.\r
\r
export interface Config {\r
  blockPrivateIP: boolean;  // resolver/browser refuses to answer a public name with a private IP\r
  dnsPinning: boolean;      // browser reuses the first-resolved IP for the page's lifetime\r
  hostValidation: boolean;  // the internal service rejects requests whose Host header isn't its own name\r
}\r
\r
export interface Step { actor: 'victim' | 'attacker' | 'browser' | 'internal'; detail: string; ip?: string; blocked?: boolean }\r
export interface Result { steps: Step[]; success: boolean; blockedBy: string | null }\r
\r
export function simulate(cfg: Config): Result {\r
  const steps: Step[] = [\r
    { actor: 'victim', detail: 'Victim opens http://evil.com', ip: '6.6.6.6 (attacker)' },\r
    { actor: 'browser', detail: 'Browser loads the attacker’s JavaScript; the page origin is evil.com', ip: '6.6.6.6 (attacker)' },\r
  ];\r
\r
  // Step: the attacker flips the DNS record to a private/internal address.\r
  if (cfg.blockPrivateIP) {\r
    steps.push({ actor: 'attacker', detail: 'Attacker flips evil.com → 127.0.0.1, but the resolver refuses to answer a public name with a private IP', ip: '127.0.0.1', blocked: true });\r
    return { steps, success: false, blockedBy: 'Block private-IP answers (DNS rebinding protection)' };\r
  }\r
  steps.push({ actor: 'attacker', detail: 'Attacker flips evil.com’s DNS record → 127.0.0.1 (short TTL)', ip: '127.0.0.1' });\r
\r
  // Step: the JS re-fetches; DNS pinning would keep the old (attacker) IP.\r
  if (cfg.dnsPinning) {\r
    steps.push({ actor: 'browser', detail: 'JS calls fetch("http://evil.com/admin"), but the browser has PINNED the first IP for this page — the request goes back to the attacker, not inside', ip: '6.6.6.6 (attacker)', blocked: true });\r
    return { steps, success: false, blockedBy: 'DNS pinning (browser reuses the first-resolved IP)' };\r
  }\r
  steps.push({ actor: 'browser', detail: 'JS calls fetch("http://evil.com/admin"); the browser re-resolves evil.com → 127.0.0.1', ip: '127.0.0.1' });\r
  steps.push({ actor: 'internal', detail: 'The request reaches the LOCAL service on the victim’s machine/network (router admin, metadata, dev server)' });\r
\r
  // Step: the internal service checks the Host header.\r
  if (cfg.hostValidation) {\r
    steps.push({ actor: 'internal', detail: 'The service checks the Host header, sees "evil.com" ≠ its own name, and rejects the request', blocked: true });\r
    return { steps, success: false, blockedBy: 'Host-header validation on the internal service' };\r
  }\r
  steps.push({ actor: 'internal', detail: 'The service answers (no Host check); the response returns to the browser' });\r
  steps.push({ actor: 'attacker', detail: 'Same origin (evil.com), so the attacker’s JS reads the internal response and exfiltrates it' });\r
  return { steps, success: true, blockedBy: null };\r
}\r
`;export{e as default};