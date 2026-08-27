var e=`// Feature flags — decoupling DEPLOY (the code is on the servers) from RELEASE (the feature is on for a\r
// user). Ship the code dark, then turn it on independently: for an internal cohort, then a 5% canary,\r
// then everyone — and flip it off instantly (a kill switch) if it misbehaves, no redeploy. Evaluation\r
// is a fixed precedence: a disabled flag is off for everyone; otherwise targeting RULES match first\r
// (e.g. country = US, or plan = beta); otherwise a PERCENTAGE rollout decides, bucketed by a stable hash\r
// of (flag, user) so a given user is consistently in or out — and increasing the percentage only ever\r
// ADDS users, never flips someone back off. Reference: the practice behind LaunchDarkly / Flagger /\r
// Unleash; Humble & Farley on decoupling deploy from release.\r
\r
export interface Rule { attribute: string; value: string; result: boolean }\r
export interface Flag { key: string; enabled: boolean; rules: Rule[]; rolloutPercent: number }\r
export type User = Record<string, string>; // must include an \`id\`\r
export interface Evaluation { on: boolean; reason: string; bucket: number }\r
\r
/** Stable 0–99 bucket for a (flag, user) pair (FNV-1a) — same inputs always land in the same bucket. */\r
export function bucketOf(flagKey: string, userId: string): number {\r
  let h = 0x811c9dc5 >>> 0;\r
  const s = \`\${flagKey}:\${userId}\`;\r
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }\r
  return h % 100;\r
}\r
\r
/** Evaluate a flag for a user, returning the decision and WHY (kill switch → rule → rollout). */\r
export function evaluate(flag: Flag, user: User): Evaluation {\r
  const bucket = bucketOf(flag.key, user.id ?? '');\r
  if (!flag.enabled) return { on: false, reason: 'flag disabled (kill switch) — off for everyone', bucket };\r
  for (const r of flag.rules) {\r
    if (user[r.attribute] === r.value) return { on: r.result, reason: \`targeting rule: \${r.attribute} = \${r.value} → \${r.result ? 'on' : 'off'}\`, bucket };\r
  }\r
  if (bucket < flag.rolloutPercent) return { on: true, reason: \`in the \${flag.rolloutPercent}% rollout (bucket \${bucket} < \${flag.rolloutPercent})\`, bucket };\r
  return { on: false, reason: \`outside the rollout (bucket \${bucket} ≥ \${flag.rolloutPercent})\`, bucket };\r
}\r
`;export{e as default};