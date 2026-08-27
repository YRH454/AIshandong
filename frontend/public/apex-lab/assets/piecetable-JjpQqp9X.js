var e=`// Piece table — the data structure a real text editor (VS Code, and historically Word) uses to represent the\r
// document you're editing. The naive approach — keep the text in one big string/array and splice on every\r
// keystroke — is O(n) per edit (you shift everything after the cursor) and makes undo awkward. A piece table\r
// flips it around with two insights. (1) The ORIGINAL text is loaded once and NEVER mutated — it's read-only.\r
// (2) Everything you type goes into a separate APPEND-ONLY "add" buffer that also never has anything removed.\r
// The document itself is then just an ordered list of PIECES, each a (which-buffer, start, length) span into\r
// one of those two immutable buffers. Inserting text = append it to the add buffer and splice one descriptor\r
// into the piece list; deleting = shrink/split descriptors. The actual character data never moves. Because no\r
// bytes are ever overwritten, undo/redo is almost free (you keep old piece lists), edits are cheap, and the\r
// original file can even stay memory-mapped. The cost is that reading the Nth character means walking the piece\r
// list (editors keep a balanced tree / line cache over the pieces to make that fast too). This models the two\r
// buffers and the piece list directly. Reference: Crowley, "Data Structures for Text Sequences" (1998); the\r
// VS Code text-buffer reimplementation write-up.\r
\r
export type BufferName = 'orig' | 'add';\r
export interface Piece { buffer: BufferName; start: number; len: number }\r
\r
export class PieceTable {\r
  readonly orig: string;   // the immutable original buffer\r
  add = '';                // the append-only add buffer\r
  pieces: Piece[] = [];    // the document, as spans into orig/add\r
\r
  constructor(text: string) {\r
    this.orig = text;\r
    if (text.length) this.pieces.push({ buffer: 'orig', start: 0, len: text.length });\r
  }\r
\r
  private bufFor(b: BufferName): string { return b === 'orig' ? this.orig : this.add; }\r
\r
  /** The current document text — walk the pieces and concatenate their spans. */\r
  getText(): string {\r
    return this.pieces.map((p) => this.bufFor(p.buffer).slice(p.start, p.start + p.len)).join('');\r
  }\r
\r
  get length(): number { return this.pieces.reduce((n, p) => n + p.len, 0); }\r
\r
  /** Ensure a piece boundary exists exactly at document position \`pos\`, splitting a piece if needed.\r
   *  Returns the piece index at which content from \`pos\` onward begins. */\r
  private splitAt(pos: number): number {\r
    if (pos <= 0) return 0;\r
    let acc = 0;\r
    for (let i = 0; i < this.pieces.length; i++) {\r
      const p = this.pieces[i];\r
      if (acc === pos) return i;                 // boundary already at the start of piece i\r
      if (acc + p.len === pos) return i + 1;     // boundary at the end of piece i\r
      if (acc + p.len > pos) {                    // pos is interior to piece i → split it\r
        const left = pos - acc;\r
        this.pieces.splice(i, 1,\r
          { buffer: p.buffer, start: p.start, len: left },\r
          { buffer: p.buffer, start: p.start + left, len: p.len - left });\r
        return i + 1;\r
      }\r
      acc += p.len;\r
    }\r
    return this.pieces.length;                    // pos at or past the end\r
  }\r
\r
  /** Insert \`text\` at document position \`pos\`. Appends to the add buffer; never touches existing data. */\r
  insert(pos: number, text: string): void {\r
    if (text.length === 0) return;\r
    const addStart = this.add.length;\r
    this.add += text;                             // append-only\r
    const i = this.splitAt(Math.max(0, Math.min(pos, this.length)));\r
    this.pieces.splice(i, 0, { buffer: 'add', start: addStart, len: text.length });\r
  }\r
\r
  /** Delete \`count\` characters starting at \`pos\`. Only descriptors change; no character data is removed. */\r
  delete(pos: number, count: number): void {\r
    if (count <= 0) return;\r
    const start = Math.max(0, Math.min(pos, this.length));\r
    const end = Math.max(0, Math.min(pos + count, this.length));\r
    if (end <= start) return;\r
    const i = this.splitAt(start);\r
    const j = this.splitAt(end);\r
    this.pieces.splice(i, j - i);                 // drop the descriptors covering [start, end)\r
  }\r
}\r
`;export{e as default};