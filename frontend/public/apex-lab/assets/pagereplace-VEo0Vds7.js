var e=`// Page replacement — when memory is full and a new page is needed, which resident page do you\r
// evict? The OS virtual-memory manager and a database buffer pool face the identical question, and\r
// the answer drives how many slow page faults (disk reads) you take. We simulate four classic\r
// policies on a page-reference string with a fixed number of frames:\r
//   • FIFO   — evict the oldest-loaded page. Simple, but suffers Belady's anomaly.\r
//   • LRU    — evict the least-recently-used page. The practical gold standard; needs usage tracking.\r
//   • OPT    — evict the page used farthest in the FUTURE (Belady's optimal). Unrealizable (needs a\r
//              crystal ball), but it's the lower bound every real policy is measured against.\r
//   • CLOCK  — second-chance: a cheap LRU approximation using one reference bit per frame.\r
// The honest, surprising result is BELADY'S ANOMALY: under FIFO, giving a process MORE frames can\r
// cause MORE faults. The fault counts here are anchored to the textbook reference string. Tested.\r
\r
export type Algo = 'FIFO' | 'LRU' | 'OPT' | 'CLOCK';\r
\r
export interface PgStep {\r
  page: number; // the page referenced at this step\r
  hit: boolean; // already resident?\r
  frames: (number | null)[]; // frame contents after this reference\r
  victim: number | null; // page evicted to make room (null on a hit or into a free frame)\r
  hand?: number; // CLOCK hand position (CLOCK only)\r
  refbits?: number[]; // CLOCK reference bits after this step (CLOCK only)\r
}\r
\r
export interface PgResult { algo: Algo; numFrames: number; steps: PgStep[]; faults: number; hits: number }\r
\r
export function simulate(algo: Algo, refs: number[], numFrames: number): PgResult {\r
  const frames: (number | null)[] = new Array(numFrames).fill(null);\r
  const steps: PgStep[] = [];\r
  let faults = 0;\r
\r
  // FIFO insertion order / LRU recency list hold the PAGES currently resident\r
  const order: number[] = []; // FIFO: oldest first ; LRU: least-recently-used first\r
  const ref = new Array(numFrames).fill(0); // CLOCK reference bits\r
  let hand = 0; // CLOCK hand\r
\r
  const freeSlot = () => frames.indexOf(null);\r
\r
  for (let t = 0; t < refs.length; t++) {\r
    const page = refs[t];\r
    const present = frames.indexOf(page);\r
    let victim: number | null = null;\r
\r
    if (present >= 0) {\r
      // HIT\r
      if (algo === 'LRU') { order.splice(order.indexOf(page), 1); order.push(page); } // refresh recency\r
      if (algo === 'CLOCK') ref[present] = 1; // give it a second chance later\r
    } else {\r
      // FAULT\r
      faults++;\r
      const free = freeSlot();\r
      if (free >= 0 && algo !== 'CLOCK') {\r
        frames[free] = page;\r
        if (algo === 'FIFO' || algo === 'LRU') order.push(page);\r
      } else if (algo === 'CLOCK') {\r
        const f2 = freeSlot();\r
        if (f2 >= 0) { frames[f2] = page; ref[f2] = 1; }\r
        else {\r
          while (ref[hand] === 1) { ref[hand] = 0; hand = (hand + 1) % numFrames; } // clear & advance\r
          victim = frames[hand];\r
          frames[hand] = page; ref[hand] = 1; hand = (hand + 1) % numFrames; // load, set bit, move on\r
        }\r
      } else {\r
        // pick a victim PAGE per policy, then reuse its slot\r
        let vp: number;\r
        if (algo === 'FIFO') vp = order.shift()!; // oldest loaded\r
        else if (algo === 'LRU') vp = order.shift()!; // least recently used (front of recency)\r
        else vp = optVictim(frames, refs, t); // OPT: used farthest in the future\r
        victim = vp;\r
        const slot = frames.indexOf(vp);\r
        frames[slot] = page;\r
        if (algo === 'FIFO' || algo === 'LRU') order.push(page);\r
      }\r
    }\r
\r
    const step: PgStep = { page, hit: present >= 0, frames: [...frames], victim };\r
    if (algo === 'CLOCK') { step.hand = hand; step.refbits = [...ref]; }\r
    steps.push(step);\r
  }\r
\r
  return { algo, numFrames, steps, faults, hits: refs.length - faults };\r
}\r
\r
/** OPT: among resident pages, evict the one whose next use is farthest away (or never used again). */\r
function optVictim(frames: (number | null)[], refs: number[], t: number): number {\r
  let victim = frames[0]!;\r
  let farthest = -1;\r
  for (const p of frames) {\r
    if (p === null) continue;\r
    let next = Infinity;\r
    for (let j = t + 1; j < refs.length; j++) if (refs[j] === p) { next = j; break; }\r
    if (next > farthest) { farthest = next; victim = p; }\r
  }\r
  return victim;\r
}\r
\r
/** The textbook reference string that exhibits Belady's anomaly under FIFO. */\r
export const BELADY_STRING = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];\r
`;export{e as default};