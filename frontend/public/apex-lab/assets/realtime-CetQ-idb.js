var e=`// Realtime delivery: long-poll vs SSE vs WebSocket — three ways to push server events to a browser,\r
// and why the latency differs. WebSocket and SSE keep a connection OPEN, so a server event reaches the\r
// client in one network hop. Long-poll can't: the client makes a request, the server holds it until an\r
// event, replies, and the client must RE-REQUEST — and any event that fires during that reconnect gap\r
// waits for the next poll to open. We model each transport's server→client delivery time over an event\r
// stream (one-way delay = owd), exposing long-poll's reconnect-gap penalty. Pure timing model, tested.\r
\r
export type Transport = 'longpoll' | 'sse' | 'websocket';\r
\r
export interface Ev { id: number; readyMs: number } // a server event becomes available at readyMs\r
export interface Delivery { id: number; readyMs: number; deliveredMs: number; delayMs: number }\r
\r
export interface RtOpts { owdMs: number; reconnectMs: number } // owd = one-way delay; reconnect = client re-request gap\r
\r
/** Compute when each event is delivered to the client under a transport. */\r
export function deliver(transport: Transport, events: Ev[], o: RtOpts): Delivery[] {\r
  const evs = [...events].sort((a, b) => a.readyMs - b.readyMs);\r
  if (transport !== 'longpoll') {\r
    // open connection: the event is pushed the instant it's ready (one hop)\r
    return evs.map((e) => ({ id: e.id, readyMs: e.readyMs, deliveredMs: e.readyMs + o.owdMs, delayMs: o.owdMs }));\r
  }\r
  // long-poll: an event can only be answered while a poll is open; otherwise it waits for the next one\r
  let pollOpenAt = 0;\r
  return evs.map((e) => {\r
    const respondAt = Math.max(e.readyMs, pollOpenAt); // wait if we're between polls\r
    const deliveredMs = respondAt + o.owdMs;\r
    pollOpenAt = deliveredMs + o.owdMs + o.reconnectMs; // response reaches client → client re-requests → request arrives\r
    return { id: e.id, readyMs: e.readyMs, deliveredMs, delayMs: deliveredMs - e.readyMs };\r
  });\r
}\r
\r
/** SSE reconnect with Last-Event-ID: after a drop the client resends the last id it saw, and the\r
 *  server replays everything AFTER it — no gap in the stream. (WebSocket has no built-in equivalent;\r
 *  the app must implement its own resume.) */\r
export function sseReplay(allEvents: Ev[], lastEventId: number): Ev[] {\r
  return allEvents.filter((e) => e.id > lastEventId);\r
}\r
\r
export const maxDelay = (ds: Delivery[]): number => Math.max(0, ...ds.map((d) => d.delayMs));\r
`;export{e as default};