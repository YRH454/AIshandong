var e=`// Clickjacking — tricking you into clicking something you can't see. A malicious page loads the real\r
// target site (your bank, say) in an invisible iframe, positions its sensitive button under a decoy the\r
// page invites you to click ("Win a prize!"), and makes the iframe transparent. Your click lands on the\r
// REAL button inside the framed site — which is fully logged in via your cookies — so you "Transfer\r
// money" or "Delete account" without knowing. The defense is to forbid being framed by other origins:\r
// the legacy X-Frame-Options header (DENY / SAMEORIGIN) or the modern CSP frame-ancestors directive.\r
// The browser refuses to render the frame at all if the policy doesn't permit the framing origin, so the\r
// overlay has nothing to hijack. Reference: OWASP clickjacking; RFC 7034 (X-Frame-Options); CSP Level 2/3.\r
\r
export interface FramePolicy { xfo: 'DENY' | 'SAMEORIGIN' | null; frameAncestors: string[] | null } // null = header not set\r
export interface FrameDecision { allowed: boolean; reason: string; clickjackable: boolean }\r
\r
/** Can \`framerOrigin\` embed \`targetOrigin\` in an iframe under \`policy\`? frame-ancestors (if present)\r
 *  takes precedence over X-Frame-Options; with no protection at all, framing is allowed (and the page\r
 *  is clickjackable). */\r
export function canFrame(targetOrigin: string, framerOrigin: string, policy: FramePolicy): FrameDecision {\r
  const sameOrigin = framerOrigin === targetOrigin;\r
  // modern: CSP frame-ancestors wins when set\r
  if (policy.frameAncestors !== null) {\r
    if (policy.frameAncestors.length === 0 || policy.frameAncestors.includes("'none'")) {\r
      return { allowed: false, reason: "frame-ancestors 'none' — no site may frame it", clickjackable: false };\r
    }\r
    const allowed = policy.frameAncestors.some((a) => (a === "'self'" ? sameOrigin : a === '*' || a === framerOrigin));\r
    return { allowed, reason: allowed ? \`framer is in frame-ancestors\` : \`framer not in frame-ancestors\`, clickjackable: allowed && !sameOrigin };\r
  }\r
  // legacy: X-Frame-Options\r
  if (policy.xfo === 'DENY') return { allowed: false, reason: 'X-Frame-Options: DENY', clickjackable: false };\r
  if (policy.xfo === 'SAMEORIGIN') return { allowed: sameOrigin, reason: sameOrigin ? 'same origin allowed' : 'X-Frame-Options: SAMEORIGIN blocks cross-origin', clickjackable: false };\r
  // no framing protection at all\r
  return { allowed: true, reason: 'no X-Frame-Options or frame-ancestors → any site can frame it', clickjackable: !sameOrigin };\r
}\r
`;export{e as default};