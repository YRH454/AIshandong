var e=`// Rendezvous hashing (a.k.a. Highest Random Weight, HRW) — a beautifully simple way to decide which server owns
// a given key, with the same "barely anything moves when the cluster changes" property as consistent hashing,
// but without the ring, the virtual nodes, or the bookkeeping. The whole algorithm: to place a key, compute a
// score hash(key, node) for EVERY node, and pick the node with the highest score. That's it. Because the hash
// mixes the key and the node together, the scores are effectively random per (key,node) pair, so keys spread
// evenly across nodes. And when a node is removed, only the keys that scored highest on THAT node need a new
// home — they fall through to their second-highest, and every other key stays exactly where it was. Add a node
// and only the keys for which the newcomer now scores highest move to it; no key ever shuffles between two
// existing nodes. Sorting the scores gives you a full preference list for free, so replicating to the "top K
// nodes" is trivial (great for choosing replicas or fallback caches). The cost is O(N) hashes per lookup, which
// is why it shines for modest N (CDN cache selection, shard routing, gossip peer choice) while consistent
// hashing's O(log N) ring wins at very large N. Reference: Thaler & Ravishankar, "Using Name-Based Mappings to
// Increase Hit Rates" (IEEE/ACM ToN, 1998).

/** A 32-bit hash mixing the key and node together — the "random weight" of placing \`key\` on \`node\`. */
export function weight(key: string, node: string): number {
  let h = 0x811c9dc5;
  const s = key + '\0' + node;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  // a final avalanche so similar (key,node) strings don't cluster
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12;
  return h >>> 0;
}

/** All nodes ranked by descending weight for this key — a preference list. Ties break by node name (stable). */
export function ranking(key: string, nodes: string[]): string[] {
  return [...nodes].sort((a, b) => weight(key, b) - weight(key, a) || (a < b ? -1 : 1));
}

/** The node that owns this key: the highest weight. */
export function assign(key: string, nodes: string[]): string {
  let best = nodes[0], bestW = weight(key, nodes[0]);
  for (let i = 1; i < nodes.length; i++) {
    const w = weight(key, nodes[i]);
    if (w > bestW || (w === bestW && nodes[i] < best)) { best = nodes[i]; bestW = w; }
  }
  return best;
}

/** How many keys each node owns. */
export function distribution(keys: string[], nodes: string[]): Record<string, number> {
  const d: Record<string, number> = Object.fromEntries(nodes.map((n) => [n, 0]));
  for (const k of keys) d[assign(k, nodes)]++;
  return d;
}

/** The set of keys whose owner changes going from \`before\` to \`after\` — the disruption of a membership change. */
export function moved(keys: string[], before: string[], after: string[]): string[] {
  return keys.filter((k) => assign(k, before) !== assign(k, after));
}
`;export{e as default};