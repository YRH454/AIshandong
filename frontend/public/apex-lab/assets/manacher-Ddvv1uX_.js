var e=`// Manacher's algorithm — the longest palindromic substring in O(n). The brute force is O(n³) (try every\r
// substring, check each); expanding around every center is O(n²). Manacher gets to LINEAR with one idea:\r
// palindromes are mirror-symmetric, so once you've found a big palindrome you already KNOW the radius at\r
// positions inside it — they mirror positions you've measured on the other side. You only ever do new\r
// character comparisons that push the known boundary further right, so the total work is O(n). The classic\r
// trick to handle even- and odd-length palindromes uniformly is to interleave a separator (#a#b#a#) so\r
// every palindrome has an odd length in the transformed string. Reference: Manacher (1975); the standard\r
// linear-time longest-palindrome algorithm.\r
\r
export interface ManacherResult {\r
  transformed: string;  // the '#'-interleaved string the algorithm works on\r
  radii: number[];      // P[i] = palindrome radius (in transformed coords) centered at i; = palindrome length in the original\r
  longest: string;      // the longest palindromic substring of the input\r
  start: number;        // its start index in the original string\r
  length: number;       // its length\r
  comparisons: number;  // character comparisons that EXTENDED a palindrome — stays ~O(n)\r
}\r
\r
/** Longest palindromic substring via Manacher's algorithm. */\r
export function manacher(s: string): ManacherResult {\r
  // Work on an ARRAY of code points (not a string): indexing a string mid-surrogate would split non-BMP\r
  // characters (emoji) and break the equality checks. t alternates separator / code-point / separator …\r
  const chars = [...s];\r
  const t: string[] = ['#'];\r
  for (const c of chars) t.push(c, '#'); // interleave separators; every palindrome is now odd-length\r
  const n = t.length;\r
  const p = new Array(n).fill(0);\r
  let center = 0, right = 0, comparisons = 0; // [center−right, center+right] is the rightmost-reaching palindrome\r
\r
  for (let i = 0; i < n; i++) {\r
    if (i < right) {\r
      const mirror = 2 * center - i;       // i's reflection across the current center\r
      p[i] = Math.min(right - i, p[mirror]); // reuse the mirror's radius, capped by the known boundary\r
    }\r
    // try to grow past what the mirror guaranteed — the only place new comparisons happen\r
    while (i - p[i] - 1 >= 0 && i + p[i] + 1 < n && t[i - p[i] - 1] === t[i + p[i] + 1]) {\r
      p[i]++; comparisons++;\r
    }\r
    if (i + p[i] > right) { center = i; right = i + p[i]; } // extend the rightmost boundary\r
  }\r
\r
  let length = 0, ci = 0;\r
  for (let i = 0; i < n; i++) if (p[i] > length) { length = p[i]; ci = i; }\r
  const start = (ci - length) / 2; // map the transformed-center back to the original string\r
  const longest = chars.slice(start, start + length).join('');\r
  return { transformed: t.join(''), radii: p, longest, start, length, comparisons };\r
}\r
`;export{e as default};