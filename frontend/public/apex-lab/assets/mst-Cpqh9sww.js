var e=`// Minimum spanning tree — the cheapest set of edges that connects every node, and the two classic\r
// greedy algorithms that find it. Kruskal sorts ALL edges and adds the next cheapest that doesn't form\r
// a cycle (using union-find to test connectivity). Prim grows ONE tree outward, repeatedly adding the\r
// cheapest edge that leaves the tree. Both are greedy and both are optimal — the cut property guarantees\r
// the lightest edge crossing any cut is safe — so they always reach the same total weight (the edge set\r
// is unique when weights are distinct). Reference: CLRS ch.23; Kruskal 1956, Prim 1957.\r
\r
export interface Edge { u: string; v: string; w: number }\r
export interface KruskalStep { edge: Edge; accepted: boolean; reason: string }\r
// \`connected\` is false when the graph is disconnected — then \`tree\` is a minimum spanning FOREST (one tree per\r
// component), not a spanning tree, and no set of edges can connect every node. Callers should check it rather\r
// than mistaking a partial forest for a full MST.\r
export interface MstResult { tree: Edge[]; weight: number; steps: KruskalStep[]; order: string[]; connected: boolean }\r
\r
export function nodes(edges: Edge[]): string[] {\r
  const s = new Set<string>();\r
  for (const e of edges) { s.add(e.u); s.add(e.v); }\r
  return [...s].sort();\r
}\r
\r
// --- Kruskal: sort edges, union-find to reject cycles ---------------------------\r
class DSU {\r
  parent: Record<string, string> = {};\r
  find(x: string): string { while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x]; } return x; }\r
  union(a: string, b: string): boolean { const ra = this.find(a), rb = this.find(b); if (ra === rb) return false; this.parent[ra] = rb; return true; }\r
}\r
\r
export function kruskal(edges: Edge[]): MstResult {\r
  const ns = nodes(edges);\r
  const dsu = new DSU();\r
  for (const n of ns) dsu.parent[n] = n;\r
  const sorted = [...edges].sort((a, b) => a.w - b.w || (a.u + a.v < b.u + b.v ? -1 : 1));\r
  const tree: Edge[] = [];\r
  const steps: KruskalStep[] = [];\r
  for (const e of sorted) {\r
    const ok = dsu.union(e.u, e.v);\r
    steps.push({ edge: e, accepted: ok, reason: ok ? 'connects two components' : 'would form a cycle — skip' });\r
    if (ok) tree.push(e);\r
  }\r
  // a connected graph on n nodes has a spanning tree of exactly n−1 edges\r
  const connected = tree.length === Math.max(0, ns.length - 1);\r
  return { tree, weight: tree.reduce((a, e) => a + e.w, 0), steps, order: tree.map((e) => \`\${e.u}-\${e.v}\`), connected };\r
}\r
\r
// --- Prim: grow one tree from a start node --------------------------------------\r
export function prim(edges: Edge[], start?: string): MstResult {\r
  const ns = nodes(edges);\r
  const src = start ?? ns[0];\r
  const inTree = new Set([src]);\r
  const tree: Edge[] = [];\r
  const steps: KruskalStep[] = [];\r
  while (inTree.size < ns.length) {\r
    // cheapest edge with exactly one endpoint in the tree. Compare WEIGHT NUMERICALLY first (a string\r
    // key would order "10" before "2"); break ties by the sorted endpoint names for determinism.\r
    let best: Edge | null = null;\r
    const tie = (x: Edge) => [x.u, x.v].sort().join('');\r
    for (const e of edges) {\r
      const a = inTree.has(e.u), b = inTree.has(e.v);\r
      if (a !== b && (!best || e.w < best.w || (e.w === best.w && tie(e) < tie(best)))) best = e;\r
    }\r
    if (!best) break; // no edge leaves the tree → the graph is disconnected; stop with a partial forest\r
    inTree.add(inTree.has(best.u) ? best.v : best.u);\r
    tree.push(best);\r
    steps.push({ edge: best, accepted: true, reason: 'cheapest edge leaving the tree' });\r
  }\r
  const connected = inTree.size === ns.length; // reached every node?\r
  return { tree, weight: tree.reduce((a, e) => a + e.w, 0), steps, order: tree.map((e) => \`\${e.u}-\${e.v}\`), connected };\r
}\r
`;export{e as default};