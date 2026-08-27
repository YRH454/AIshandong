var e=`// Service Worker caching strategies. A Service Worker is a script the browser runs between the page and the network; it\r
// intercepts every fetch and decides how to answer. That decision is a policy with a real tradeoff between freshness,\r
// speed, and offline availability. This models the five common strategies given whether the network is up and whether a\r
// cached copy exists: what gets served, whether it's fresh, whether it's fast (cache) or slow (network), and whether it\r
// kicks off a background revalidation to refresh the cache for next time.\r
\r
export type Strategy = 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'network-only' | 'cache-only';\r
export interface Env { online: boolean; cached: boolean }\r
export interface Outcome { served: 'cache' | 'network' | 'error'; fresh: boolean; fast: boolean; revalidates: boolean; note: string }\r
\r
const fromCache = (revalidates: boolean, note: string): Outcome => ({ served: 'cache', fresh: false, fast: true, revalidates, note });\r
const fromNetwork = (note: string): Outcome => ({ served: 'network', fresh: true, fast: false, revalidates: false, note });\r
const error = (note: string): Outcome => ({ served: 'error', fresh: false, fast: false, revalidates: false, note });\r
\r
export function handle(strategy: Strategy, env: Env): Outcome {\r
  switch (strategy) {\r
    case 'cache-first':\r
      if (env.cached) return fromCache(false, 'Served from cache immediately — fast, and works offline, but may be stale until the cache is updated.');\r
      if (env.online) return fromNetwork('Cache miss, so fetched from the network and cached for next time.');\r
      return error('Cache miss and offline — nothing to serve.');\r
    case 'network-first':\r
      if (env.online) return fromNetwork('Fetched fresh from the network (and cached); the slower but always-current path.');\r
      if (env.cached) return fromCache(false, 'Offline, so fell back to the cached copy — possibly stale, but the app still works.');\r
      return error('Offline with no cached copy — the request fails.');\r
    case 'stale-while-revalidate':\r
      if (env.cached) return fromCache(env.online, env.online ? 'Served the cached copy instantly AND fetched a fresh one in the background to update the cache for next time — fast now, fresh soon.' : 'Served the cached copy instantly; offline, so no background refresh this time.');\r
      if (env.online) return fromNetwork('No cached copy yet, so fetched from the network and cached it.');\r
      return error('No cached copy and offline — nothing to serve.');\r
    case 'network-only':\r
      return env.online ? fromNetwork('Always goes to the network — never cached, so always fresh but dead offline.') : error('network-only offline — the request fails; there is no cache to fall back to.');\r
    case 'cache-only':\r
      return env.cached ? fromCache(false, 'Served from the precached cache; never touches the network (a fixed app shell).') : error('cache-only with nothing cached — the request fails.');\r
  }\r
}\r
`;export{e as default};