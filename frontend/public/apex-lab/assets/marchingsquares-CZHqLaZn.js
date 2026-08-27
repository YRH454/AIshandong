var e=`// Marching squares — how you turn a grid of numbers into a smooth outline. Given a scalar FIELD sampled on a grid\r
// (elevation on a map, brightness in a scan, a "density" summed from a few sources) and a THRESHOLD, it draws the\r
// contour where the field equals that value: the coastline between above-water and below-water. The trick is\r
// purely local. Look at one cell — its four corners are each either above or below the threshold, giving 2^4 = 16\r
// possible cases. In every case the contour must enter and leave through the edges that separate an above corner\r
// from a below corner, and you know exactly which edges those are, so you just draw the segment(s) connecting\r
// them. Do that for every cell independently and the pieces join up into closed curves. For a smooth result you\r
// don't cut edges at their midpoints — you LINEAR-INTERPOLATE the crossing to where the field actually equals the\r
// threshold, so at threshold 1.0 a corner at 0.9 and one at 1.1 crosses right in the middle (t=0.5), but 0.8 and\r
// 1.8 crosses only a fifth of the way up (t=0.2, near the low corner). It's embarrassingly parallel (each cell is independent — great for the\r
// GPU) and it's the 2-D sibling of MARCHING CUBES, which does the same per-cube to build 3-D surfaces from\r
// medical CT/MRI volumes and from metaballs in graphics. This models the field, the per-cell cases, and the\r
// interpolated contour segments. Reference: Lorensen & Cline, marching cubes, SIGGRAPH (1987); the 2-D case is\r
// folklore of the same era.\r
\r
export interface Seg { x1: number; y1: number; x2: number; y2: number }\r
export interface Blob { x: number; y: number; r: number }\r
\r
/** A metaball scalar field: each cell gets the summed 1/dist² "influence" of the blobs. field[r][c]. */\r
export function metaballField(cols: number, rows: number, blobs: Blob[]): number[][] {\r
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {\r
    let v = 0;\r
    for (const b of blobs) v += (b.r * b.r) / ((c - b.x) ** 2 + (r - b.y) ** 2 + 0.0001);\r
    return v;\r
  }));\r
}\r
\r
/** Extract the contour at \`threshold\` as line segments, with linear-interpolated crossings. */\r
export function marchingSquares(f: number[][], threshold: number): Seg[] {\r
  const rows = f.length, cols = f[0].length, segs: Seg[] = [];\r
  const lerp = (x1: number, y1: number, v1: number, x2: number, y2: number, v2: number): [number, number] => {\r
    const t = (threshold - v1) / (v2 - v1);\r
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];\r
  };\r
  for (let r = 0; r < rows - 1; r++) {\r
    for (let c = 0; c < cols - 1; c++) {\r
      const tl = f[r][c], tr = f[r][c + 1], br = f[r + 1][c + 1], bl = f[r + 1][c];\r
      const above = (v: number) => v >= threshold;\r
      const pts: { x: number; y: number }[] = []; // crossings in edge order T,R,B,L\r
      if (above(tl) !== above(tr)) { const [x, y] = lerp(c, r, tl, c + 1, r, tr); pts.push({ x, y }); }       // top\r
      if (above(tr) !== above(br)) { const [x, y] = lerp(c + 1, r, tr, c + 1, r + 1, br); pts.push({ x, y }); } // right\r
      if (above(br) !== above(bl)) { const [x, y] = lerp(c + 1, r + 1, br, c, r + 1, bl); pts.push({ x, y }); } // bottom\r
      if (above(bl) !== above(tl)) { const [x, y] = lerp(c, r + 1, bl, c, r, tl); pts.push({ x, y }); }         // left\r
      if (pts.length === 2) {\r
        segs.push({ x1: pts[0].x, y1: pts[0].y, x2: pts[1].x, y2: pts[1].y });\r
      } else if (pts.length === 4) { // saddle: disambiguate by the cell's center (bilinear average)\r
        const center = (tl + tr + br + bl) / 4;\r
        // If the center is on tl's side, tl's diagonal region bridges through the center and stays connected,\r
        // so the contour must isolate the OTHER diagonal's corners: pair T-R and B-L. Otherwise pair T-L, R-B.\r
        if (above(center) === above(tl)) {\r
          segs.push({ x1: pts[0].x, y1: pts[0].y, x2: pts[1].x, y2: pts[1].y }); // T-R\r
          segs.push({ x1: pts[2].x, y1: pts[2].y, x2: pts[3].x, y2: pts[3].y }); // B-L\r
        } else {\r
          segs.push({ x1: pts[0].x, y1: pts[0].y, x2: pts[3].x, y2: pts[3].y }); // T-L\r
          segs.push({ x1: pts[1].x, y1: pts[1].y, x2: pts[2].x, y2: pts[2].y }); // R-B\r
        }\r
      }\r
    }\r
  }\r
  return segs;\r
}\r
\r
/** The 4-bit case index of a cell (TL,TR,BR,BL corners above threshold): 0 and 15 emit no contour. */\r
export function cellCase(tl: number, tr: number, br: number, bl: number, threshold: number): number {\r
  return (tl >= threshold ? 8 : 0) + (tr >= threshold ? 4 : 0) + (br >= threshold ? 2 : 0) + (bl >= threshold ? 1 : 0);\r
}\r
`;export{e as default};