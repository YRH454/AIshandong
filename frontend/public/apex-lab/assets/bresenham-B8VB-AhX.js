var e=`// Bresenham's line algorithm — how a computer draws a straight line on a grid of pixels, and one of the oldest\r
// tricks still running in every GPU, plotter, and drawing library (Jack Bresenham, IBM, 1962). The naive way uses\r
// the equation y = y0 + slope·(x − x0): step x by one, compute the real y, round it. But that needs a floating-\r
// point multiply and a round at every pixel — expensive on 1962 hardware and still wasteful today. Bresenham's\r
// insight is to track only an integer ERROR term: the signed distance between the true line and the pixel you last\r
// lit. Each step you ask a single question — does advancing keep the error small, or has it grown enough that you\r
// must step in the minor axis too? — and update the error with just additions and comparisons. No multiply, no\r
// divide, no floating point, no rounding: the exact same pixels the "round the real y" method would pick, computed\r
// with nothing but integer add/subtract/compare. That's why it was fast enough to rasterize in real time on early\r
// machines and why the idea (an accumulating error you correct in whole steps) reappears everywhere — circle and\r
// ellipse drawing, the DDA, even audio resampling and Bresenham-style timing loops. This models the integer\r
// algorithm (general form, all eight octants) and its decision variable. Reference: Bresenham, IBM Systems\r
// Journal (1965).\r
\r
export interface Pixel { x: number; y: number; err: number }\r
\r
/** The general integer Bresenham line from (x0,y0) to (x1,y1): only add/subtract/compare, no float. */\r
export function bresenham(x0: number, y0: number, x1: number, y1: number): Pixel[] {\r
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);\r
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;\r
  let err = dx - dy, x = x0, y = y0;\r
  const pixels: Pixel[] = [];\r
  for (;;) {\r
    pixels.push({ x, y, err });\r
    if (x === x1 && y === y1) break;\r
    const e2 = 2 * err;\r
    if (e2 > -dy) { err -= dy; x += sx; } // error allows an x step\r
    if (e2 < dx) { err += dx; y += sy; }  // error forces a y step\r
  }\r
  return pixels;\r
}\r
\r
/** The exact real-line y (or x) for comparison — the value Bresenham approximates without ever computing it. */\r
export const trueY = (x: number, x0: number, y0: number, x1: number, y1: number): number =>\r
  x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);\r
`;export{e as default};