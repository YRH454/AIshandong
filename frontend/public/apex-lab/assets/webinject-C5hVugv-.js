var e=`// Injection attacks (SQLi & XSS), and the one idea that stops both: keep untrusted input\r
// as DATA, never let it become CODE. SQL injection happens when input is concatenated\r
// into a query so a quote can close the string literal and the rest is parsed as SQL;\r
// parameterized queries bind the value out-of-band so quotes stay data. Cross-site\r
// scripting happens when input is dropped into HTML so a '<' can start a <script> or an\r
// event-handler element; HTML-escaping turns '<' into '&lt;' so it can only be text.\r
// This models the exact boundary — what breaks out, and how the fix neutralizes it.\r
// Pure and tested against canonical OWASP payloads.\r
\r
// ── SQL injection ──────────────────────────────────────────────────────────────\r
export interface SqliAnalysis {\r
  concatQuery: string;   // the query a naive string-concatenation builds\r
  breaksOut: boolean;    // input contains a quote that closes the '...' literal\r
  comments: boolean;     // input contains a SQL comment that truncates the rest\r
  tautology: boolean;    // input adds an always-true condition (OR 1=1 / OR 'a'='a')\r
  vulnerable: boolean;\r
}\r
\r
const TEMPLATE = "SELECT * FROM users WHERE name = '<INPUT>'";\r
\r
export function analyzeSqli(input: string): SqliAnalysis {\r
  const concatQuery = TEMPLATE.replace('<INPUT>', input);\r
  const breaksOut = input.includes("'");\r
  const comments = /--|#|\\/\\*/.test(input);\r
  const tautology = /\\bor\\b\\s+('?\\w+'?\\s*=\\s*'?\\w+'?|\\d+\\s*=\\s*\\d+)/i.test(input);\r
  return { concatQuery, breaksOut, comments, tautology, vulnerable: breaksOut && (comments || tautology || /;\\s*\\w/.test(input)) };\r
}\r
\r
/** The parameterized form: the value is bound separately, so it is never parsed as SQL. */\r
export function parameterizedSqli(input: string): { query: string; boundParam: string; vulnerable: boolean } {\r
  return { query: "SELECT * FROM users WHERE name = ?", boundParam: input, vulnerable: false };\r
}\r
\r
// ── Cross-site scripting ───────────────────────────────────────────────────────\r
const HTML_ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };\r
\r
/** OWASP HTML-context escaping. */\r
export function escapeHtml(s: string): string {\r
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);\r
}\r
\r
/** Would this string execute script if dropped into an HTML body context? Each vector\r
 *  requires a LIVE tag (a raw '<'), so HTML-escaping — which removes every raw '<' —\r
 *  neutralizes all of them. A bare "javascript:" in text is harmless and not flagged. */\r
function executes(html: string): boolean {\r
  return /<\\s*script/i.test(html)            // a <script> element\r
    || /<[^>]+\\son\\w+\\s*=/i.test(html)       // a tag with an on*= event handler\r
    || /<[^>]+javascript:/i.test(html);      // a tag attribute with a javascript: URL\r
}\r
\r
export interface XssAnalysis {\r
  rawHtml: string;\r
  escapedHtml: string;\r
  executesRaw: boolean;     // unescaped insertion runs the payload\r
  executesEscaped: boolean; // after escaping it cannot\r
}\r
\r
export function analyzeXss(input: string): XssAnalysis {\r
  const rawHtml = \`<div class="comment">\${input}</div>\`;\r
  const escapedHtml = \`<div class="comment">\${escapeHtml(input)}</div>\`;\r
  return { rawHtml, escapedHtml, executesRaw: executes(rawHtml), executesEscaped: executes(escapedHtml) };\r
}\r
`;export{e as default};