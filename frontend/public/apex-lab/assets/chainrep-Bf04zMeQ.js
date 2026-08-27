var e=`// Chain replication — a way to keep N replicas strongly consistent that's simpler than quorums and gives\r
// linearizable reads cheaply. Arrange the replicas in a CHAIN: head → middle(s) → tail. A WRITE goes to the\r
// head and propagates down the chain one node at a time; it is COMMITTED only when it reaches the TAIL,\r
// which then acks the client. A READ is served entirely by the TAIL — and because the tail only holds\r
// values that have made it all the way down, every read sees the latest committed write: strong consistency,\r
// no quorum math, and reads don't touch the head at all (great read throughput). Failures are easy: lose the\r
// head → its successor becomes head; lose the tail → its predecessor becomes tail; lose a middle node → link\r
// around it. Reference: van Renesse & Schneider, "Chain Replication for Supporting High Throughput and\r
// Availability" (OSDI 2004); CRAQ extends it to read from any node.\r
\r
export interface NodeState { id: string; value: string }\r
\r
/** Snapshot of every node's value while a new write is in flight, propagated to \`depth\` (0 = head only,\r
 *  ids.length-1 = reached the tail). Nodes at index ≤ depth hold newV; the rest still hold oldV. */\r
export function propagate(ids: string[], oldV: string, newV: string, depth: number): NodeState[] {\r
  return ids.map((id, i) => ({ id, value: i <= depth ? newV : oldV }));\r
}\r
\r
/** A write is committed exactly when it has propagated all the way to the tail. */\r
export const isCommitted = (ids: string[], depth: number): boolean => depth >= ids.length - 1;\r
\r
/** Reads are served by the tail — so they only ever return committed values (the new write isn't visible\r
 *  until it reaches the tail). This is what makes chain replication linearizable. */\r
export function read(state: NodeState[]): string {\r
  return state[state.length - 1].value;\r
}\r
\r
export interface Reconfig { newChain: string[]; newHead: string; newTail: string; role: 'head' | 'tail' | 'middle' }\r
\r
/** Reconfigure the chain after a node fails: drop it and relabel head/tail. */\r
export function reconfigure(ids: string[], failed: string): Reconfig {\r
  const idx = ids.indexOf(failed);\r
  const role = idx === 0 ? 'head' : idx === ids.length - 1 ? 'tail' : 'middle';\r
  const newChain = ids.filter((id) => id !== failed);\r
  return { newChain, newHead: newChain[0], newTail: newChain[newChain.length - 1], role };\r
}\r
`;export{e as default};