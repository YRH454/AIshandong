var e=`// Mix networks (Chaum, CACM 1981) — the anonymity primitive that low-latency onion routing is NOT. Tor forwards\r
// each cell immediately, so an adversary who watches both ends can correlate their TIMING and link sender to\r
// receiver. A MIX defeats exactly that: it waits until it holds a BATCH of messages, strips one encryption layer\r
// off each (so nothing can be followed by its bytes), then releases the whole batch in a RANDOM order. Watching a\r
// mix flush a batch of N, an adversary can do no better than a 1-in-N guess at which output was which input — that\r
// N is the ANONYMITY SET. Chains of mixes and cover traffic compound it. The cost versus Tor is latency: a message\r
// waits for its batch to fill. (Chaum 1981; modern designs: Mixminion, Sphinx, Loopix.)\r
import { mulberry32 } from './reservoir';\r
\r
export type Msg = { id: number; layers: number; wire: string };\r
\r
// Each hop re-encrypts, so the bytes on the wire change and can't be followed by content. We derive a short,\r
// deterministic token per (id, remaining layers) as a stand-in — what's cryptographically real in a mixnet is a\r
// layered scheme like Sphinx; what's modelled and tested here is the batching, the permutation, and the 1/N metric.\r
export function wireOf(id: number, layers: number): string {\r
  const r = mulberry32((id + 1) * 1000 + layers);\r
  let s = '';\r
  for (let i = 0; i < 4; i++) s += Math.floor(r() * 256).toString(16).padStart(2, '0');\r
  return s;\r
}\r
\r
export function makeMsg(id: number, layers: number): Msg {\r
  return { id, layers, wire: wireOf(id, layers) };\r
}\r
\r
// Peel one layer: the message advances a hop, so its layer count drops and its on-wire bytes change.\r
export function peel(m: Msg): Msg {\r
  const layers = Math.max(0, m.layers - 1);\r
  return { id: m.id, layers, wire: wireOf(m.id, layers) };\r
}\r
\r
// A uniform permutation of [0..n) by Fisher–Yates over a seeded PRNG (deterministic for a given seed).\r
export function permutation(n: number, seed: number): number[] {\r
  const rng = mulberry32(seed);\r
  const p = Array.from({ length: n }, (_, i) => i);\r
  for (let i = n - 1; i > 0; i--) {\r
    const j = Math.floor(rng() * (i + 1));\r
    [p[i], p[j]] = [p[j], p[i]];\r
  }\r
  return p;\r
}\r
\r
// A threshold mix flushes when it holds \`inputs.length\` messages: peel a layer off each, then emit them shuffled.\r
// \`perm[k]\` is the index of the input that became output k — the true wiring the observer cannot see.\r
export function mixBatch(inputs: Msg[], seed: number): { outputs: Msg[]; perm: number[] } {\r
  const perm = permutation(inputs.length, seed);\r
  const outputs = perm.map((i) => peel(inputs[i]));\r
  return { outputs, perm };\r
}\r
\r
// The anonymity set is the batch size; the best an observer can do to link one message is a uniform guess.\r
export function anonymitySet(batch: number): number {\r
  return batch;\r
}\r
export function linkProbability(batch: number): number {\r
  return batch > 0 ? 1 / batch : 1;\r
}\r
`;export{e as default};