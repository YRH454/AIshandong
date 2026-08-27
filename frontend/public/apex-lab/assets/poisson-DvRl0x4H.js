var e=`// Poisson-disk sampling — how to scatter points that look random but never clump: every pair is at least a\r
// distance r apart, yet the whole area stays evenly covered with no gaps. This "blue noise" (energy concentrated\r
// at high frequencies, none in the clumpy low ones) is what your eye finds pleasing and what rendering needs:\r
// throw uniformly-random points and they bunch up and leave holes (white noise), which shows up as splotchy\r
// shadows and grainy antialiasing; blue-noise points give clean, artifact-free results. It's used for\r
// antialiasing and soft-shadow sample placement, stippling and halftoning, scattering trees/grass/rocks in\r
// procedural worlds, dithering, and even the arrangement of cones in your retina. The naive method — "dart\r
// throwing," keep guessing points and reject any too close — grinds to a halt as the area fills. Robert Bridson's\r
// 2007 algorithm is O(n): keep an ACTIVE list of points that might still have room nearby; repeatedly pick one,\r
// fire k candidate darts into the annulus between r and 2r around it (close enough to pack tightly, far enough not\r
// to violate r), and accept the first candidate that's ≥ r from all existing points; if all k miss, that point is\r
// "full" and leaves the active list. The trick that makes the distance check O(1) is a background GRID with cells\r
// of side r/√2 — small enough that each cell holds at most one sample, so a candidate only needs to check a fixed\r
// 5×5 block of neighboring cells. This models Bridson's algorithm and the grid acceleration. Reference: Bridson,\r
// "Fast Poisson Disk Sampling in Arbitrary Dimensions," SIGGRAPH sketches (2007).\r
\r
export interface Pt { x: number; y: number }\r
\r
/** Bridson's Poisson-disk sampling on [0,width]×[0,height] with minimum spacing r; k candidates per active point. */\r
export function poissonDisk(width: number, height: number, r: number, seed = 1, k = 30): Pt[] {\r
  let s = seed >>> 0 || 1;\r
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x80000000; };\r
\r
  const cell = r / Math.SQRT2;                 // ≤1 sample per cell\r
  const gw = Math.ceil(width / cell), gh = Math.ceil(height / cell);\r
  const grid = new Int32Array(gw * gh).fill(-1); // point index per cell, -1 = empty\r
  const gi = (x: number, y: number) => Math.floor(y / cell) * gw + Math.floor(x / cell);\r
\r
  const points: Pt[] = [], active: number[] = [];\r
  const push = (p: Pt) => { points.push(p); active.push(points.length - 1); grid[gi(p.x, p.y)] = points.length - 1; };\r
\r
  const farEnough = (p: Pt): boolean => {\r
    const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);\r
    for (let yy = Math.max(0, cy - 2); yy <= Math.min(gh - 1, cy + 2); yy++) {\r
      for (let xx = Math.max(0, cx - 2); xx <= Math.min(gw - 1, cx + 2); xx++) {\r
        const idx = grid[yy * gw + xx];\r
        if (idx !== -1) { const q = points[idx]; if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < r * r) return false; }\r
      }\r
    }\r
    return true;\r
  };\r
\r
  push({ x: rng() * width, y: rng() * height });\r
  while (active.length) {\r
    const ai = Math.floor(rng() * active.length);\r
    const p = points[active[ai]];\r
    let found = false;\r
    for (let t = 0; t < k; t++) {\r
      const ang = rng() * 2 * Math.PI, rad = r * (1 + rng()); // annulus [r, 2r]\r
      const cand = { x: p.x + Math.cos(ang) * rad, y: p.y + Math.sin(ang) * rad };\r
      if (cand.x < 0 || cand.x >= width || cand.y < 0 || cand.y >= height) continue;\r
      if (farEnough(cand)) { push(cand); found = true; break; }\r
    }\r
    if (!found) active.splice(ai, 1); // this point is full\r
  }\r
  return points;\r
}\r
\r
/** Plain uniform-random points (white noise) — for the clumpy contrast. */\r
export function whiteNoise(width: number, height: number, n: number, seed = 1): Pt[] {\r
  let s = seed >>> 0 || 1;\r
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x80000000; };\r
  return Array.from({ length: n }, () => ({ x: rng() * width, y: rng() * height }));\r
}\r
`;export{e as default};