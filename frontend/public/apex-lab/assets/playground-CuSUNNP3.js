var e=`// The playground runner. Apex is static and offline, so it runs the one language it can honestly execute in the page —\r
// JavaScript — inside a sandboxed Web Worker (no DOM, killable, timed out). It captures console output and the last\r
// expression's value and returns the REAL result; nothing is faked. Go/Python/Rust/C/C++ stay read-only examples\r
// elsewhere because running them would need a backend or heavy WASM. formatValue is pure and unit-tested; runJs is\r
// browser-only (Worker/Blob) and verified by running it in the UI.\r
\r
export interface RunResult { logs: string[]; result?: string; error?: string; ms: number }\r
\r
// Render a value the way a console would — readable, stable, and cycle-safe.\r
export function formatValue(v: unknown, seen: WeakSet<object> = new WeakSet()): string {\r
  if (v === null) return 'null';\r
  if (v === undefined) return 'undefined';\r
  const t = typeof v;\r
  if (t === 'string') return v as string;\r
  if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v);\r
  if (t === 'function') return \`[Function\${(v as { name?: string }).name ? ': ' + (v as { name: string }).name : ' (anonymous)'}]\`;\r
  if (t === 'symbol') return (v as symbol).toString();\r
  if (typeof v === 'object') {\r
    if (seen.has(v as object)) return '[Circular]';\r
    seen.add(v as object);\r
    if (Array.isArray(v)) return '[' + v.map((x) => formatValue(x, seen)).join(', ') + ']';\r
    const o = v as Record<string, unknown>;\r
    return '{ ' + Object.keys(o).map((k) => \`\${k}: \${formatValue(o[k], seen)}\`).join(', ') + ' }';\r
  }\r
  return String(v);\r
}\r
\r
// The worker body, as a string. It rebinds console to collect output, evaluates the user's code, and posts back the\r
// captured logs plus the value of the final expression. formatValue is inlined so the worker is self-contained.\r
function workerSource(): string {\r
  return \`\r
const FMT = \${formatValue.toString()};\r
self.onmessage = (e) => {\r
  const logs = [];\r
  // Must return undefined (like real console.*), or the completion value of code ending in console.log() would be the\r
  // array length instead of undefined.\r
  const push = (args) => { logs.push(args.map((a) => FMT(a)).join(' ')); };\r
  self.console = { log: (...a) => push(a), info: (...a) => push(a), warn: (...a) => push(a), error: (...a) => push(a), debug: (...a) => push(a) };\r
  try {\r
    const value = (0, eval)(e.data);\r
    self.postMessage({ logs, result: value === undefined ? undefined : FMT(value) });\r
  } catch (err) {\r
    self.postMessage({ logs, error: (err && err.message) ? err.message : String(err) });\r
  }\r
};\`;\r
}\r
\r
// Run JS in a throwaway Worker with a hard timeout. Resolves with the real logs/result/error.\r
export function runJs(code: string, timeoutMs = 2000): Promise<RunResult> {\r
  return new Promise((resolve) => {\r
    const start = performance.now();\r
    let worker: Worker | null = null;\r
    let url = '';\r
    const done = (r: Omit<RunResult, 'ms'>) => {\r
      clearTimeout(timer);\r
      if (worker) worker.terminate();\r
      if (url) URL.revokeObjectURL(url);\r
      resolve({ ...r, ms: Math.round(performance.now() - start) });\r
    };\r
    const timer = setTimeout(() => done({ logs: [], error: \`timed out after \${timeoutMs}ms (an infinite loop?)\` }), timeoutMs);\r
    try {\r
      url = URL.createObjectURL(new Blob([workerSource()], { type: 'text/javascript' }));\r
      worker = new Worker(url);\r
      worker.onmessage = (e: MessageEvent<Omit<RunResult, 'ms'>>) => done(e.data);\r
      worker.onerror = (e) => done({ logs: [], error: e.message || 'worker error' });\r
      worker.postMessage(code);\r
    } catch (err) {\r
      done({ logs: [], error: err instanceof Error ? err.message : String(err) });\r
    }\r
  });\r
}\r
`;export{e as default};