var e=`// KV cache & PagedAttention — why an LLM server fits many chats in fixed GPU memory. Each generated token appends a\r
// key+value vector to that sequence's KV cache, so the cache is the memory bottleneck of inference. The naive layout\r
// gives each sequence one CONTIGUOUS slab sized for the model's max context, so almost all of it is reserved-but-empty\r
// (internal fragmentation) and only a couple of sequences fit. vLLM's PagedAttention instead splits the cache into\r
// fixed-size BLOCKS and gives each sequence a block table (logical→physical, exactly like OS page tables), allocating\r
// blocks on demand — so you only pay for tokens that exist and far more sequences fit. This models that accounting.\r
\r
export const blocksNeeded = (tokens: number, blockSize: number): number => Math.ceil(tokens / blockSize);\r
\r
export interface Alloc { perSeqBlocks: number; seqsFit: number; usedBlocks: number; wastedPct: number }\r
\r
// Naive: reserve enough blocks for the MODEL'S MAX context per sequence, up front, before you know how long it gets.\r
export function naiveAlloc(totalBlocks: number, blockSize: number, maxLen: number, curLen: number): Alloc {\r
  const perSeqBlocks = blocksNeeded(maxLen, blockSize);\r
  const seqsFit = Math.floor(totalBlocks / perSeqBlocks);\r
  const usedBlocks = seqsFit * perSeqBlocks;\r
  const reservedTokens = seqsFit * perSeqBlocks * blockSize;\r
  const liveTokens = seqsFit * curLen;\r
  const wastedPct = reservedTokens === 0 ? 0 : Math.round((1 - liveTokens / reservedTokens) * 100);\r
  return { perSeqBlocks, seqsFit, usedBlocks, wastedPct };\r
}\r
\r
// Paged: allocate only the blocks the CURRENT length needs; the only waste is the slack in each sequence's last block.\r
export function pagedAlloc(totalBlocks: number, blockSize: number, curLen: number): Alloc {\r
  const perSeqBlocks = blocksNeeded(curLen, blockSize);\r
  const seqsFit = perSeqBlocks === 0 ? totalBlocks : Math.floor(totalBlocks / perSeqBlocks);\r
  const usedBlocks = seqsFit * perSeqBlocks;\r
  const reservedTokens = seqsFit * perSeqBlocks * blockSize;\r
  const liveTokens = seqsFit * curLen;\r
  const wastedPct = reservedTokens === 0 ? 0 : Math.round((1 - liveTokens / reservedTokens) * 100);\r
  return { perSeqBlocks, seqsFit, usedBlocks, wastedPct };\r
}\r
`;export{e as default};