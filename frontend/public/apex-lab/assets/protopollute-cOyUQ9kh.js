var e=`// Prototype pollution — a JavaScript-specific vulnerability where attacker-controlled JSON reaches deep into a\r
// program's object model and changes the behaviour of objects it never touched. In JS almost every object\r
// inherits from a single shared Object.prototype; read a property an object doesn't have and the engine walks\r
// up to that prototype. Now consider a common "deep merge" that recursively copies a config/JSON payload onto\r
// an object. If the payload contains the key "__proto__", a naive merge follows it — and "__proto__" is the\r
// live link to the shared prototype. So merging {"__proto__": {"isAdmin": true}} writes isAdmin=true onto the\r
// prototype every object inherits from. Suddenly ({}).isAdmin is true everywhere: an auth check that reads\r
// user.isAdmin passes for everyone; a flag that gates a debug shell flips on globally; a library that trusts a\r
// default suddenly sees an attacker's value. This file SIMULATES the vulnerability in a sandbox — it models\r
// its own "prototype" object and never mutates the real Object.prototype — to show the mechanism and the fix\r
// (drop the dangerous keys, or use a null-prototype object / Map). Reference: the __proto__ / prototype-\r
// pollution class (Arteau, 2018) that hit lodash, jQuery, and many merge/query-string parsers.\r
\r
export interface Env { proto: Record<string, unknown> } // the simulated shared prototype\r
export const freshEnv = (): Env => ({ proto: {} });\r
\r
const isObj = (x: unknown): x is Record<string, any> => typeof x === 'object' && x !== null && !Array.isArray(x);\r
const DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);\r
\r
/** Property lookup with a prototype chain: own property first, else fall back to the shared prototype. */\r
export function lookup(obj: Record<string, any>, key: string, env: Env): unknown {\r
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : env.proto[key];\r
}\r
\r
/** The VULNERABLE deep merge: it honours both routes to the shared prototype, writing attacker data onto it. */\r
export function vulnerableMerge(target: Record<string, any>, source: Record<string, any>, env: Env): void {\r
  for (const key of Object.keys(source)) {\r
    // "__proto__" is the live link to the shared prototype — a naive merge follows it and pollutes.\r
    if (key === '__proto__') { vulnerableMerge(env.proto as Record<string, any>, source[key], env); continue; }\r
    // ...and so is "constructor.prototype": obj.constructor.prototype IS the shared prototype, so the same\r
    // pollution goes through a payload that dodges a filter blocking only the literal "__proto__" key.\r
    if (key === 'constructor' && isObj(source[key]) && isObj(source[key].prototype)) { vulnerableMerge(env.proto as Record<string, any>, source[key].prototype, env); continue; }\r
    if (isObj(source[key])) { if (!isObj(target[key])) target[key] = {}; vulnerableMerge(target[key], source[key], env); }\r
    else target[key] = source[key];\r
  }\r
}\r
\r
/** The SAFE deep merge: dangerous keys are dropped, so the prototype is untouchable. */\r
export function safeMerge(target: Record<string, any>, source: Record<string, any>, env: Env): void {\r
  for (const key of Object.keys(source)) {\r
    if (DANGEROUS.has(key)) continue; // ignore __proto__ / constructor / prototype\r
    if (isObj(source[key])) { if (!isObj(target[key])) target[key] = {}; safeMerge(target[key], source[key], env); }\r
    else target[key] = source[key];\r
  }\r
}\r
\r
/** Parse a JSON payload keeping "__proto__" as an OWN key (JSON.parse already does this). */\r
export const parsePayload = (json: string): Record<string, any> => JSON.parse(json);\r
\r
/** Run a merge and report what a FRESH, empty object now sees for a set of probe keys — the blast radius. */\r
export function demo(json: string, mode: 'vulnerable' | 'safe', probes: string[]): { env: Env; polluted: Record<string, unknown>; freshObjectSees: Record<string, unknown>; target: Record<string, any> } {\r
  const env = freshEnv();\r
  const target: Record<string, any> = {};\r
  const source = parsePayload(json);\r
  (mode === 'vulnerable' ? vulnerableMerge : safeMerge)(target, source, env);\r
  const freshObjectSees: Record<string, unknown> = {};\r
  for (const k of probes) freshObjectSees[k] = lookup({}, k, env); // a brand-new {} inherits polluted props\r
  return { env, polluted: { ...env.proto }, freshObjectSees, target };\r
}\r
`;export{e as default};