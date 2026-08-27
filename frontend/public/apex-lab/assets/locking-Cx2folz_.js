var e=`// Two-phase locking (2PL) and deadlock — the lock-based alternative to MVCC for keeping\r
// concurrent transactions correct. Before touching a row a transaction must take a lock:\r
// SHARED (read) locks coexist, but an EXCLUSIVE (write) lock conflicts with everything. If\r
// the lock you want is held incompatibly, you WAIT. The danger: two transactions can each\r
// wait for a lock the other holds — a cycle in the "wait-for" graph, a deadlock that never\r
// resolves on its own. Databases detect the cycle and abort a victim. This models the lock\r
// table, the wait-for graph, and cycle detection. Pure, tested.\r
\r
export type Mode = 'S' | 'X';\r
export interface Request { txid: number; resource: string; mode: Mode }\r
\r
interface Hold { txid: number; mode: Mode }\r
\r
const compatible = (a: Mode, b: Mode) => a === 'S' && b === 'S'; // only shared+shared coexist\r
\r
export interface Outcome {\r
  granted: Request[];\r
  waiting: Request[];\r
  holders: Record<string, Hold[]>;\r
  waitFor: [number, number][]; // edge txid_i → txid_j : i waits for j\r
  deadlock: number[] | null;   // the txids in a wait cycle, or null\r
}\r
\r
/** Process lock requests in order; a request that can't be granted blocks and adds wait-for\r
 *  edges to every transaction currently holding the resource incompatibly. A repeat request by a\r
 *  transaction that already holds the resource is treated as a RE-ENTRANT grant; lock UPGRADES\r
 *  (e.g. S→X while another tx holds S) are out of scope for this teaching model. */\r
export function run(requests: Request[]): Outcome {\r
  const holders: Record<string, Hold[]> = {};\r
  const granted: Request[] = [];\r
  const waiting: Request[] = [];\r
  const waitFor: [number, number][] = [];\r
\r
  for (const req of requests) {\r
    const held = holders[req.resource] ?? (holders[req.resource] = []);\r
    if (held.some((h) => h.txid === req.txid)) { granted.push(req); continue; } // already holds it\r
    const conflicts = held.filter((h) => !compatible(h.mode, req.mode));\r
    if (conflicts.length === 0) { held.push({ txid: req.txid, mode: req.mode }); granted.push(req); }\r
    else { waiting.push(req); for (const h of conflicts) waitFor.push([req.txid, h.txid]); }\r
  }\r
\r
  return { granted, waiting, holders, waitFor, deadlock: findCycle(waitFor) };\r
}\r
\r
/** Find one cycle in the wait-for graph (DFS), returning the txids on it. */\r
export function findCycle(edges: [number, number][]): number[] | null {\r
  const adj = new Map<number, number[]>();\r
  for (const [a, b] of edges) if (a !== b) (adj.get(a) ?? adj.set(a, []).get(a)!).push(b); // a tx never waits for itself\r
  const state = new Map<number, number>(); // 0=unseen,1=on-stack,2=done\r
  const stack: number[] = [];\r
\r
  const dfs = (u: number): number[] | null => {\r
    state.set(u, 1); stack.push(u);\r
    for (const v of adj.get(u) ?? []) {\r
      if (state.get(v) === 1) return stack.slice(stack.indexOf(v)); // back-edge → cycle\r
      if (!state.get(v)) { const c = dfs(v); if (c) return c; }\r
    }\r
    state.set(u, 2); stack.pop();\r
    return null;\r
  };\r
\r
  for (const node of adj.keys()) if (!state.get(node)) { const c = dfs(node); if (c) return c; }\r
  return null;\r
}\r
`;export{e as default};