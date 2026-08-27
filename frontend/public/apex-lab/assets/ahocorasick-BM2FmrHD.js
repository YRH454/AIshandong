var e=`// Aho-Corasick — find ALL occurrences of MANY patterns in one pass over the text. KMP and Rabin-Karp\r
// hunt for a single pattern; Aho-Corasick builds one automaton for the whole dictionary and matches them\r
// simultaneously in O(text + matches), independent of how many patterns there are. It's a trie of the\r
// patterns plus FAILURE LINKS: when the current path can't extend, the failure link jumps to the longest\r
// proper suffix that is still a prefix of some pattern (the same idea as KMP's failure function, lifted\r
// to a trie). Output links collect every pattern that ends at the current state. It's what powers fgrep,\r
// virus scanners, and intrusion-detection rule engines. Reference: Aho & Corasick (CACM 1975).\r
\r
export interface ACNode { id: number; children: Record<string, number>; fail: number; out: string[]; depth: number; char: string; parent: number }\r
export interface Match { pattern: string; start: number; end: number }\r
\r
export class AhoCorasick {\r
  nodes: ACNode[] = [{ id: 0, children: {}, fail: 0, out: [], depth: 0, char: '', parent: -1 }];\r
\r
  constructor(patterns: string[]) {\r
    for (const p of patterns) if (p) this.insert(p);\r
    this.buildFailureLinks();\r
  }\r
\r
  private insert(pattern: string) {\r
    let cur = 0;\r
    for (const ch of pattern) {\r
      if (this.nodes[cur].children[ch] === undefined) {\r
        const id = this.nodes.length;\r
        this.nodes.push({ id, children: {}, fail: 0, out: [], depth: this.nodes[cur].depth + 1, char: ch, parent: cur });\r
        this.nodes[cur].children[ch] = id;\r
      }\r
      cur = this.nodes[cur].children[ch];\r
    }\r
    this.nodes[cur].out.push(pattern);\r
  }\r
\r
  // BFS from the root: a node's failure link is the deepest other node reachable by following its parent's\r
  // failure link and matching the same incoming character; output links accumulate along failure links.\r
  private buildFailureLinks() {\r
    const queue: number[] = [];\r
    for (const v of Object.values(this.nodes[0].children)) { this.nodes[v].fail = 0; queue.push(v); }\r
    while (queue.length) {\r
      const u = queue.shift()!;\r
      for (const [ch, v] of Object.entries(this.nodes[u].children)) {\r
        queue.push(v);\r
        let f = this.nodes[u].fail;\r
        while (f !== 0 && this.nodes[f].children[ch] === undefined) f = this.nodes[f].fail;\r
        const cand = this.nodes[f].children[ch];\r
        this.nodes[v].fail = cand !== undefined && cand !== v ? cand : 0;\r
        this.nodes[v].out = [...this.nodes[v].out, ...this.nodes[this.nodes[v].fail].out];\r
      }\r
    }\r
  }\r
\r
  /** The transition function: from state \`s\` on character \`ch\`, following failure links on mismatch. */\r
  go(s: number, ch: string): number {\r
    let cur = s;\r
    while (cur !== 0 && this.nodes[cur].children[ch] === undefined) cur = this.nodes[cur].fail;\r
    return this.nodes[cur].children[ch] ?? 0;\r
  }\r
\r
  /** Scan \`text\`, returning every (pattern, start, end) match across all dictionary patterns. */\r
  search(text: string): Match[] {\r
    const matches: Match[] = [];\r
    let cur = 0;\r
    for (let i = 0; i < text.length; i++) {\r
      cur = this.go(cur, text[i]);\r
      for (const pat of this.nodes[cur].out) matches.push({ pattern: pat, start: i - pat.length + 1, end: i });\r
    }\r
    return matches;\r
  }\r
\r
  /** The state visited after consuming each character — for stepping the visualization. */\r
  trace(text: string): number[] {\r
    const states: number[] = [];\r
    let cur = 0;\r
    for (let i = 0; i < text.length; i++) { cur = this.go(cur, text[i]); states.push(cur); }\r
    return states;\r
  }\r
}\r
`;export{e as default};