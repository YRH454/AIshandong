var e=`// SIEM log correlation — how a security monitor catches an attack that no single log line reveals. A SIEM ingests\r
// events from many sources and runs CORRELATION RULES over a sliding time window. The canonical rule is brute-force\r
// detection: K or more failed logins from the SAME source within W seconds is an attack in progress; a success\r
// right after is a likely compromise. Detection is a tuning trade-off — too loose misses the attack (false\r
// negative), too tight fires on benign bursts (false positives). Modelled: the windowed count and its verdict.\r
\r
export type Kind = 'fail' | 'ok';\r
export type Event = { t: number; src: string; kind: Kind; attack?: boolean }; // \`attack\` = ground-truth label\r
\r
export type Rule = { k: number; window: number }; // K failures within \`window\` seconds, per source\r
\r
export type Alert = { src: string; at: number; fails: number; compromised: boolean };\r
\r
// Run the correlation rule: for each source, slide over its events; whenever K failures fall inside a \`window\`, raise\r
// one alert (marked compromised if an 'ok' from that source follows within the same window). Returns one alert per\r
// distinct brute-force burst (a source is not re-alerted until its window of failures clears).\r
export function correlate(events: Event[], rule: Rule): Alert[] {\r
  const bySrc = new Map<string, Event[]>();\r
  for (const e of [...events].sort((a, b) => a.t - b.t)) {\r
    (bySrc.get(e.src) ?? bySrc.set(e.src, []).get(e.src)!).push(e);\r
  }\r
  const alerts: Alert[] = [];\r
  for (const [src, evs] of bySrc) {\r
    const fails = evs.filter((e) => e.kind === 'fail');\r
    let i = 0, firedUntil = -Infinity;\r
    for (let j = 0; j < fails.length; j++) {\r
      while (fails[j].t - fails[i].t > rule.window) i++; // shrink window [i..j] to <= \`window\`\r
      const count = j - i + 1;\r
      if (count >= rule.k && fails[i].t > firedUntil) {\r
        const at = fails[j].t;\r
        const compromised = evs.some((e) => e.kind === 'ok' && e.t >= fails[i].t && e.t <= at + rule.window);\r
        alerts.push({ src, at, fails: count, compromised });\r
        firedUntil = at; // don't re-alert on the same burst\r
      }\r
    }\r
  }\r
  return alerts.sort((a, b) => a.at - b.at);\r
}\r
\r
// Score a rule against the ground-truth labels: an attack source is any src that emitted a labelled-attack event.\r
// A true positive is an alert on such a source; a false positive is an alert on a benign source; a false negative is\r
// an attack source that produced no alert.\r
export function score(events: Event[], rule: Rule): { detected: boolean; truePos: number; falsePos: number; falseNeg: number } {\r
  const attackSrcs = new Set(events.filter((e) => e.attack).map((e) => e.src));\r
  const alerts = correlate(events, rule);\r
  const alertedSrcs = new Set(alerts.map((a) => a.src));\r
  let falsePos = 0;\r
  for (const s of alertedSrcs) if (!attackSrcs.has(s)) falsePos++;\r
  let truePos = 0;\r
  for (const s of alertedSrcs) if (attackSrcs.has(s)) truePos++;\r
  let falseNeg = 0;\r
  for (const s of attackSrcs) if (!alertedSrcs.has(s)) falseNeg++;\r
  return { detected: falseNeg === 0 && attackSrcs.size > 0, truePos, falsePos, falseNeg };\r
}\r
`;export{e as default};