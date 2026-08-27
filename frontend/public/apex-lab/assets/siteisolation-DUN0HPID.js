var e=`// Browser site isolation (COOP / COEP / CORP) — the header handshake a page performs to get its own\r
// OS process and unlock powerful APIs, post-Spectre. Three headers cooperate:\r
//   • COOP (Cross-Origin-Opener-Policy): "same-origin" severs the window.opener link to cross-origin\r
//     pages, so this document lands in its OWN browsing-context group (a precondition for a dedicated\r
//     process and for not leaking references across origins).\r
//   • COEP (Cross-Origin-Embedder-Policy): "require-corp" says every cross-origin subresource must\r
//     OPT IN to being embedded (via CORP or CORS), so nothing foreign is pulled into the address\r
//     space without consent. "credentialless" is the softer variant: load it, but strip credentials.\r
//   • CORP (Cross-Origin-Resource-Policy): the response-side opt-in a subresource sends.\r
// When COOP=same-origin AND COEP∈{require-corp, credentialless}, the page becomes crossOriginIsolated,\r
// which re-enables SharedArrayBuffer and high-resolution timers (disabled for everyone after Spectre).\r
// We model the DECISIONS (which is honestly checkable) — not any speculative side channel. Tested\r
// against the HTML cross-origin-isolation rules and the Fetch CORP check.\r
\r
export type COOP = 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin';\r
export type COEP = 'unsafe-none' | 'require-corp' | 'credentialless';\r
export type CORP = 'none' | 'same-origin' | 'same-site' | 'cross-origin';\r
\r
export interface Isolation {\r
  crossOriginIsolated: boolean;\r
  ownContextGroup: boolean; // COOP same-origin → severed from cross-origin openers\r
  sharedArrayBuffer: boolean; // gated behind crossOriginIsolated\r
  highResTimers: boolean; // unthrottled performance.now() / 5µs resolution\r
  explain: string;\r
}\r
\r
export function isolation(coop: COOP, coep: COEP): Isolation {\r
  const ownContextGroup = coop === 'same-origin';\r
  const crossOriginIsolated = ownContextGroup && (coep === 'require-corp' || coep === 'credentialless');\r
  return {\r
    crossOriginIsolated,\r
    ownContextGroup,\r
    sharedArrayBuffer: crossOriginIsolated,\r
    highResTimers: crossOriginIsolated,\r
    explain: crossOriginIsolated\r
      ? 'COOP=same-origin gives the page its own context group; COEP guarantees every embedded resource opted in — so the page is crossOriginIsolated and the powerful APIs are unlocked.'\r
      : !ownContextGroup\r
        ? 'Without COOP=same-origin the page can still share a browsing-context group with cross-origin openers, so it is not isolated.'\r
        : 'COOP is set but COEP is unsafe-none, so embedded cross-origin resources are not guaranteed to have opted in — not isolated.',\r
  };\r
}\r
\r
export interface Subresource { label: string; crossOrigin: boolean; corp: CORP; cors: boolean }\r
export interface LoadResult { label: string; loads: boolean; credentialsStripped: boolean; reason: string }\r
\r
/** Whether a subresource is allowed to embed under the document's COEP (Fetch CORP check). */\r
export function loadSubresource(coep: COEP, s: Subresource): LoadResult {\r
  if (!s.crossOrigin) return { label: s.label, loads: true, credentialsStripped: false, reason: 'same-origin — always embeddable' };\r
  if (coep === 'unsafe-none') return { label: s.label, loads: true, credentialsStripped: false, reason: 'COEP unsafe-none — no embedding restriction' };\r
  const optedIn = s.cors || s.corp === 'cross-origin';\r
  if (coep === 'require-corp')\r
    return optedIn\r
      ? { label: s.label, loads: true, credentialsStripped: false, reason: s.cors ? 'allowed via CORS' : 'allowed via CORP: cross-origin' }\r
      : { label: s.label, loads: false, credentialsStripped: false, reason: \`BLOCKED — require-corp needs CORP: cross-origin or CORS, but this sent CORP: \${s.corp}\` };\r
  // credentialless: cross-origin no-cors loads, but without credentials; CORS/CORP load normally\r
  return optedIn\r
    ? { label: s.label, loads: true, credentialsStripped: false, reason: 'allowed (opted in via CORS/CORP)' }\r
    : { label: s.label, loads: true, credentialsStripped: true, reason: 'loaded credentialless — request sent WITHOUT cookies' };\r
}\r
`;export{e as default};