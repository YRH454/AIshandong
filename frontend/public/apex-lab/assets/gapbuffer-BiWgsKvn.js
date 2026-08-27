var e=`// The gap buffer — the simplest fast way to edit text, and what Emacs has used for decades. Keep the whole\r
// document in one array, but leave a GAP of unused slots right where the cursor is. Typing a character drops it\r
// into the gap and shrinks the gap by one — O(1), no shifting. Backspace just grows the gap leftward; delete-\r
// forward grows it rightward. The only expensive operation is MOVING the cursor: to edit somewhere else you slide\r
// the gap there, copying the characters you pass over from one side of the gap to the other — O(distance). So a\r
// gap buffer is perfect for the overwhelmingly common case (a burst of edits clustered at one point: typing a\r
// word, a line) and merely okay when the cursor jumps around a large file. The logical text is just "everything\r
// before the gap" followed by "everything after the gap"; the gap itself holds garbage the reader skips. When the\r
// gap fills up, the buffer grows (allocate bigger, re-open a gap) — amortized O(1) like a dynamic array. It's the\r
// opposite trade from a rope (a tree, O(log n) everywhere) and a piece table (spans into an append-only log):\r
// the gap buffer bets that edits have locality, and wins big when they do. This models the array + gap, insert/\r
// delete/move-cursor, and the shift cost. Reference: the Emacs and Scintilla editing buffers.\r
\r
export class GapBuffer {\r
  buf: (string | null)[];\r
  gapStart: number; gapEnd: number; // the gap is the half-open range [gapStart, gapEnd)\r
  shifts = 0;                        // characters copied across the gap (the cost of moving the cursor)\r
\r
  constructor(text = '', gapSize = 8) {\r
    this.buf = [...text, ...Array(gapSize).fill(null)];\r
    this.gapStart = text.length;     // cursor (and gap) start at the end\r
    this.gapEnd = this.buf.length;\r
  }\r
\r
  /** The logical document: text before the gap + text after it (the gap is skipped). */\r
  text(): string { return this.buf.slice(0, this.gapStart).join('') + this.buf.slice(this.gapEnd).join(''); }\r
  length(): number { return this.gapStart + (this.buf.length - this.gapEnd); }\r
  cursor(): number { return this.gapStart; }\r
\r
  private grow(): void {\r
    const extra = Math.max(8, this.buf.length);       // double-ish (amortized O(1))\r
    const after = this.buf.slice(this.gapEnd);\r
    this.buf = [...this.buf.slice(0, this.gapStart), ...Array(extra).fill(null), ...after];\r
    this.gapEnd = this.gapStart + extra;\r
  }\r
\r
  /** Move the gap (cursor) to logical position \`pos\`, sliding characters across it — O(|pos - cursor|). */\r
  moveTo(pos: number): void {\r
    pos = Math.max(0, Math.min(pos, this.length()));\r
    if (this.gapStart === this.gapEnd) { this.gapStart = this.gapEnd = pos; return; } // empty gap: buffer is packed, reposition is free\r
    while (this.gapStart > pos) { this.gapStart--; this.gapEnd--; this.buf[this.gapEnd] = this.buf[this.gapStart]; this.buf[this.gapStart] = null; this.shifts++; }\r
    while (this.gapStart < pos) { this.buf[this.gapStart] = this.buf[this.gapEnd]; this.buf[this.gapEnd] = null; this.gapStart++; this.gapEnd++; this.shifts++; }\r
  }\r
\r
  /** Insert a character at the cursor — O(1) (just fill a gap slot). */\r
  insert(ch: string): void { if (this.gapStart === this.gapEnd) this.grow(); this.buf[this.gapStart++] = ch; }\r
  /** Backspace: swallow the character left of the cursor into the gap. */\r
  deleteBack(): void { if (this.gapStart > 0) { this.gapStart--; this.buf[this.gapStart] = null; } }\r
  /** Delete-forward: swallow the character right of the cursor. */\r
  deleteForward(): void { if (this.gapEnd < this.buf.length) { this.buf[this.gapEnd] = null; this.gapEnd++; } }\r
}\r
`;export{e as default};