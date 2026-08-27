var e=`// Lamport's bakery algorithm — mutual exclusion for N threads using ONLY atomic reads and writes of shared\r
// variables: no test-and-set, no compare-and-swap, no hardware locks. The metaphor is a bakery counter: on\r
// entry you take a ticket number one higher than anyone waiting, and customers are served in ticket order,\r
// lowest first. Two subtleties make it work on real, weakly-ordered memory. (1) The DOORWAY: taking a number\r
// isn't atomic, so two threads reading the counter at the same instant can grab the SAME number — ties are\r
// broken by thread id, giving a total order (number, id). (2) A \`choosing\` flag each thread raises while\r
// picking its number, so a waiter never compares against a half-written number. Then each thread waits until\r
// its (number, id) is the smallest among all who want in. It's slow (O(N) shared reads to enter) but it's a\r
// beautiful proof that mutual exclusion needs nothing but ordinary memory. Reference: Lamport (1974).\r
\r
export interface Ticket { id: number; number: number }\r
\r
/** Total order on tickets: lower number first, ties broken by lower id — the (number, id) lexicographic key\r
 *  that guarantees exactly one thread is "first". */\r
export const before = (a: Ticket, b: Ticket): boolean => a.number < b.number || (a.number === b.number && a.id < b.id);\r
\r
/** Simulate the doorway. Each group is a set of threads that read the counter at the same instant, so they\r
 *  all take the SAME next number (a tie). Groups happen in sequence. Returns each thread's ticket. */\r
export function takeNumbers(groups: number[][]): Ticket[] {\r
  const tickets: Ticket[] = [];\r
  let max = 0;\r
  for (const group of groups) {\r
    const num = max + 1; // "one higher than anyone waiting" — everyone in this wave reads the same max\r
    for (const id of group) tickets.push({ id, number: num });\r
    max = num;\r
  }\r
  return tickets;\r
}\r
\r
/** The order in which threads enter the critical section: sorted by (number, id). */\r
export function entryOrder(tickets: Ticket[]): number[] {\r
  return [...tickets].sort((a, b) => (before(a, b) ? -1 : 1)).map((t) => t.id);\r
}\r
\r
/** Who gets the critical section right now — the single smallest (number, id). */\r
export function winner(tickets: Ticket[]): number {\r
  return tickets.reduce((best, t) => (before(t, best) ? t : best)).id;\r
}\r
\r
/** Would \`me\` wait for \`other\`? Only if other holds a strictly-earlier ticket. Because (number, id) is a\r
 *  TOTAL order, for any two threads exactly one waits for the other — no deadlock, no two-in-at-once. */\r
export const waitsFor = (me: Ticket, other: Ticket): boolean => me.id !== other.id && before(other, me);\r
`;export{e as default};