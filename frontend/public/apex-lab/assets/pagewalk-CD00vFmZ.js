var e=`// Virtual-to-physical address translation — the x86-64 4-level page-table walk. A 48-bit virtual\r
// address splits into four 9-bit table indices plus a 12-bit page offset; the MMU chases pointers\r
// CR3 → PML4 → PDPT → PD → PT to a physical frame, then tacks the offset back on. If any level's\r
// entry is "not present", the walk stops with a PAGE FAULT, which the OS handles (demand paging) by\r
// allocating a frame and restarting the instruction. The bit split is exact per the Intel SDM Vol.3\r
// §4.5 (4-level paging) / AMD64 APM Vol.2 §5.3 — 9/9/9/9/12. Anchored to that split in tests.\r
//\r
// NOTE: a 48-bit VA exceeds JS's 32-bit bitwise range, so we decompose with integer division/modulo\r
// (2^48 < 2^53, so it stays exact in a double) rather than >> / &.\r
\r
export const LEVELS = ['PML4', 'PDPT', 'PD', 'PT'] as const;\r
export type Level = typeof LEVELS[number];\r
export const PAGE_BITS = 12;\r
export const INDEX_BITS = 9;            // each level indexes 512 entries\r
export const VA_BITS = 48;\r
\r
export interface VaFields { pml4: number; pdpt: number; pd: number; pt: number; offset: number }\r
\r
/** Split a 48-bit virtual address into its four table indices + page offset (Intel SDM §4.5). */\r
export function decompose(va: number): VaFields {\r
  return {\r
    pml4: Math.floor(va / 2 ** 39) % 512,\r
    pdpt: Math.floor(va / 2 ** 30) % 512,\r
    pd: Math.floor(va / 2 ** 21) % 512,\r
    pt: Math.floor(va / 2 ** 12) % 512,\r
    offset: va % 4096,\r
  };\r
}\r
\r
/** The va as a fixed-width binary string, MSB first, grouped as [pml4|pdpt|pd|pt|offset]. */\r
export function vaBinary(va: number): string[] {\r
  const fields = decompose(va);\r
  return [\r
    fields.pml4.toString(2).padStart(9, '0'),\r
    fields.pdpt.toString(2).padStart(9, '0'),\r
    fields.pd.toString(2).padStart(9, '0'),\r
    fields.pt.toString(2).padStart(9, '0'),\r
    fields.offset.toString(2).padStart(12, '0'),\r
  ];\r
}\r
\r
// A page table is a sparse nested map; a leaf (PT entry) holds a physical frame number. We build the\r
// nested structure from a flat list of mapped pages so the walk has real entries to chase or miss.\r
export interface Mapping { va: number; frame: number }      // va is page-aligned; frame is the PFN\r
type Node = Map<number, Node | number>;\r
\r
export interface WalkStep { level: Level; index: number; present: boolean }\r
export interface WalkResult { steps: WalkStep[]; hit: boolean; frame: number | null; phys: number | null; faultLevel: Level | null }\r
\r
export class PageTable {\r
  private root: Node = new Map();\r
  constructor(mappings: Mapping[] = []) { for (const m of mappings) this.map(m.va, m.frame); }\r
\r
  /** Install a mapping for the page containing \`va\`, creating intermediate tables as needed. */\r
  map(va: number, frame: number): void {\r
    const f = decompose(va);\r
    const path = [f.pml4, f.pdpt, f.pd];\r
    let node = this.root;\r
    for (const idx of path) {\r
      let next = node.get(idx);\r
      if (!(next instanceof Map)) { next = new Map(); node.set(idx, next); }\r
      node = next;\r
    }\r
    node.set(f.pt, Math.max(0, Math.floor(frame))); // keep PFNs exact (no 32-bit bitwise truncation)\r
  }\r
\r
  /** Walk CR3 → … → PT for \`va\`, recording each level and stopping at the first not-present entry. */\r
  translate(va: number): WalkResult {\r
    const f = decompose(va);\r
    const idx = [f.pml4, f.pdpt, f.pd, f.pt];\r
    const steps: WalkStep[] = [];\r
    let node: Node | number | undefined = this.root;\r
    for (let i = 0; i < 4; i++) {\r
      const present = node instanceof Map && node.has(idx[i]);\r
      steps.push({ level: LEVELS[i], index: idx[i], present });\r
      if (!present) return { steps, hit: false, frame: null, phys: null, faultLevel: LEVELS[i] };\r
      node = (node as Node).get(idx[i]);\r
    }\r
    const frame = node as number;\r
    return { steps, hit: true, frame, phys: frame * 4096 + f.offset, faultLevel: null };\r
  }\r
\r
  isMapped(va: number): boolean { return this.translate(va).hit; }\r
}\r
\r
export const hex = (n: number, pad = 0) => '0x' + n.toString(16).toUpperCase().padStart(pad, '0');\r
`;export{e as default};