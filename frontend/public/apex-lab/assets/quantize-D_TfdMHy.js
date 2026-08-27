var e=`// Weight quantization — how a model trained in fp16 is stored and served at lower precision so it fits (and runs faster)\r
// on smaller hardware. Symmetric quantization picks a single scale for a tensor, maps every weight to the nearest of\r
// 2^bits signed integer levels, and stores the small integers; at use time it multiplies back by the scale. int4 is a\r
// quarter the size of fp16. The cost is rounding error, and the sharp edge is OUTLIERS: one large-magnitude weight sets\r
// the scale for the whole group, so the many small weights land on only a few coarse levels near zero and lose almost\r
// all their precision — the reason naive low-bit quantization hurts and methods like LLM.int8()/GPTQ/AWQ treat outliers\r
// specially. This models symmetric quantization and its error.\r
\r
export interface Quant { levels: number; scale: number; step: number; dequant: number[]; rmse: number; maxErr: number; memPct: number }\r
\r
export function quantize(weights: number[], bits: number): Quant {\r
  const qmax = Math.pow(2, bits - 1) - 1;            // signed range is [-qmax-1, qmax]\r
  const absMax = Math.max(...weights.map((w) => Math.abs(w)), 1e-9);\r
  const scale = absMax / qmax;                        // one large weight sets this for everyone\r
  const dequant = weights.map((w) => Math.max(-qmax - 1, Math.min(qmax, Math.round(w / scale))) * scale);\r
  const errs = weights.map((w, i) => w - dequant[i]);\r
  const rmse = Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / weights.length);\r
  const maxErr = Math.max(...errs.map(Math.abs));\r
  return {\r
    levels: Math.pow(2, bits),\r
    scale,\r
    step: scale,                                      // spacing between adjacent representable values\r
    dequant,\r
    rmse,\r
    maxErr,\r
    memPct: Math.round((bits / 16) * 100),            // vs fp16\r
  };\r
}\r
`;export{e as default};