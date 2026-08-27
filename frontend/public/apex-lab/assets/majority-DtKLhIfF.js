var e=`// Boyer-Moore majority vote (1981) — find the element that appears more than half the time\r
// in a stream, using a single pass and O(1) memory. The intuition is pairwise cancellation:\r
// keep a candidate and a counter; each matching element is a vote for the candidate, each\r
// differing element a vote against (and when the counter hits zero, the next element becomes\r
// the new candidate). A true majority (> n/2) can never be fully cancelled out, so it\r
// survives as the candidate. Because the trick also "survives" when no majority exists, a\r
// second pass must verify the candidate actually clears n/2. Pure, tested.\r
\r
export interface Step { value: number; candidate: number; count: number; action: 'adopt' | 'vote+' | 'vote-' }\r
\r
export interface Result {\r
  candidate: number | null;\r
  steps: Step[];\r
  isMajority: boolean; // does the candidate actually appear > n/2 times?\r
  actualCount: number;\r
  threshold: number;   // ⌊n/2⌋\r
}\r
\r
export function majorityVote(stream: number[]): Result {\r
  let candidate = 0, count = 0;\r
  const steps: Step[] = [];\r
  for (const value of stream) {\r
    let action: Step['action'];\r
    if (count === 0) { candidate = value; count = 1; action = 'adopt'; }\r
    else if (value === candidate) { count++; action = 'vote+'; }\r
    else { count--; action = 'vote-'; }\r
    steps.push({ value, candidate, count, action });\r
  }\r
  // verify: the algorithm always yields a candidate, but only a real majority clears n/2\r
  const cand = stream.length ? candidate : null;\r
  const actualCount = cand === null ? 0 : stream.filter((x) => x === cand).length;\r
  const threshold = Math.floor(stream.length / 2);\r
  return { candidate: cand, steps, isMajority: actualCount > threshold, actualCount, threshold };\r
}\r
`;export{e as default};