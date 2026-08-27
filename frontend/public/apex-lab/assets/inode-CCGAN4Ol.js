var e=`// The inode & indirect blocks — how a classic Unix filesystem (ext2/ext3, the original FFS) answers "byte N of\r
// this file lives in which disk block?" without storing one giant contiguous file (impossible as files grow and\r
// the disk fragments). Every file is an INODE: a fixed-size record holding the file's metadata (size, owner,\r
// timestamps, permissions) and, crucially, an array of pointers to its data BLOCKS. The clever part is how it\r
// scales from tiny to huge with a fixed-size inode. The first handful of pointers (classically 12) are DIRECT —\r
// they point straight at data blocks, so a small file is reached in a single disk read. When you run out, the\r
// next pointer is SINGLE-INDIRECT: it points at a block that is itself full of pointers (a 4 KB block with 4-byte\r
// pointers holds 1024 of them), so it adds 1024 more data blocks at the cost of one extra read. Then a\r
// DOUBLE-INDIRECT pointer points at a block of pointers to blocks of pointers (1024² data blocks), and a\r
// TRIPLE-INDIRECT adds 1024³ more. The beauty: small files stay fast (direct, one hop) while the same tiny inode\r
// still addresses terabytes, and the number of disk reads to reach any block is just its "depth" (1 to 4). The\r
// cost is that huge files pay more reads per block and the indirect blocks are metadata overhead — which is why\r
// modern filesystems (ext4, XFS, btrfs) largely replaced this with EXTENTS (a start block + length) for big\r
// contiguous runs. This models the block-pointer tree and the offset-to-block resolution. Reference: the ext2\r
// inode; McKusick's Fast File System (FFS).\r
\r
export type Zone = 'direct' | 'single' | 'double' | 'triple' | 'beyond';\r
export interface Resolution { zone: Zone; reads: number; withinZone: number }\r
\r
/** Data blocks addressable per indirection zone, given \`numDirect\` direct pointers and \`ppb\` pointers/block. */\r
export function capacities(numDirect: number, ppb: number): Record<Zone, number> {\r
  return { direct: numDirect, single: ppb, double: ppb * ppb, triple: ppb * ppb * ppb, beyond: 0 };\r
}\r
\r
/** Which zone (and how many disk reads) reaches logical block \`bi\`. Direct=1 read … triple=4 reads. */\r
export function resolve(bi: number, numDirect: number, ppb: number): Resolution {\r
  if (bi < numDirect) return { zone: 'direct', reads: 1, withinZone: bi };\r
  let idx = bi - numDirect;\r
  if (idx < ppb) return { zone: 'single', reads: 2, withinZone: idx };\r
  idx -= ppb;\r
  if (idx < ppb * ppb) return { zone: 'double', reads: 3, withinZone: idx };\r
  idx -= ppb * ppb;\r
  if (idx < ppb * ppb * ppb) return { zone: 'triple', reads: 4, withinZone: idx };\r
  return { zone: 'beyond', reads: 0, withinZone: idx - ppb * ppb * ppb };\r
}\r
\r
export const pointersPerBlock = (blockBytes: number, pointerBytes: number): number => Math.floor(blockBytes / pointerBytes);\r
export const maxBlocks = (numDirect: number, ppb: number): number => numDirect + ppb + ppb * ppb + ppb * ppb * ppb;\r
export const maxFileSize = (numDirect: number, ppb: number, blockBytes: number): number => maxBlocks(numDirect, ppb) * blockBytes;\r
\r
/** Resolve a byte offset to its logical block and the read path. */\r
export function resolveOffset(byteOffset: number, numDirect: number, ppb: number, blockBytes: number): Resolution & { block: number } {\r
  const block = Math.floor(byteOffset / blockBytes);\r
  return { block, ...resolve(block, numDirect, ppb) };\r
}\r
`;export{e as default};