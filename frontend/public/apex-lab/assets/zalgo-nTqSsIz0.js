var e=`// The Z-algorithm — linear-time string matching from one elegant array. Z[i] is the length of the longest\r
// substring starting at position i that is ALSO a prefix of the string. Computing every Z[i] naively is\r
// O(n²); the trick is to remember the rightmost match window [l, r) you've already verified: if i falls\r
// inside it, you already know s[i..] mirrors s[i-l..] there, so you can copy that Z value (capped at the\r
// window edge) and only ever compare *new* characters past r. Each character is matched at most once as you\r
// extend r, so the whole array is O(n). To find a pattern P in text T, run Z over "P§T" (a separator not in\r
// either): every position where Z ≥ |P| is a match. It's the conceptual cousin of KMP — same linear bound,\r
// but many find the Z-array easier to reason about. Reference: Gusfield, "Algorithms on Strings, Trees, and\r
// Sequences" (1997).\r
\r
// NUL: a code point that never appears in normal text/emoji input, so a match can't span the P|T boundary.\r
const SEP = String.fromCharCode(0); // NUL sentinel\r
\r
// Core on a code-point array (emoji-safe: we index code points, not UTF-16 units).\r
function zc(s: string[]): number[] {\r
  const n = s.length;\r
  const z = new Array(n).fill(0);\r
  // z[0] is left 0 by convention (the whole string trivially matches its own prefix).\r
  let l = 0, r = 0; // [l, r) is the rightmost segment known to match a prefix\r
  for (let i = 1; i < n; i++) {\r
    if (i < r) z[i] = Math.min(r - i, z[i - l]); // reuse the mirror value, capped at the window edge\r
    while (i + z[i] < n && s[z[i]] === s[i + z[i]]) z[i]++; // extend by comparing only new characters\r
    if (i + z[i] > r) { l = i; r = i + z[i]; } // grew the window → remember it\r
  }\r
  return z;\r
}\r
\r
/** The Z-array of a string. z[i] = length of the longest prefix of \`str\` starting at code-point index i. */\r
export function zArray(str: string): number[] {\r
  return zc([...str]);\r
}\r
\r
/** All start positions (code-point indices in \`text\`) where \`pattern\` occurs, via Z over "pattern§text". */\r
export function search(text: string, pattern: string): number[] {\r
  if (pattern.length === 0) return [];\r
  const pat = [...pattern], txt = [...text];\r
  const comb = [...pat, SEP, ...txt];\r
  const z = zc(comb);\r
  const m = pat.length;\r
  const out: number[] = [];\r
  for (let i = m + 1; i < comb.length; i++) if (z[i] >= m) out.push(i - m - 1); // -m-1 maps back into text\r
  return out;\r
}\r
\r
/** The combined "pattern§text" string and its Z-array — for visualizing how matching works. \`combined\` uses a\r
 *  visible § for display; the Z-array is computed with the same-length NUL separator so indices line up. */\r
export function matchTrace(text: string, pattern: string): { combined: string[]; z: number[]; sepIndex: number } {\r
  const pat = [...pattern], txt = [...text];\r
  const combined = [...pat, '§', ...txt];\r
  return { combined, z: zc([...pat, SEP, ...txt]), sepIndex: pat.length };\r
}\r
`;export{e as default};