var e=`// Walk a StateMachine through a sequence of events, collecting the states it\r
// visits. Pure — the state-machine view animates over this. Generic over any\r
// StateMachine; the event list is a teaching choice passed in by the view.\r
import type { ConversationSpec, DissectionNode, StateMachine } from '../core/types';\r
\r
export interface StateStep {\r
  state: string; // state BEFORE the event\r
  event: string | null; // event that fires from here (null at the end)\r
  next: string | null; // resulting state\r
}\r
\r
/** Follow \`events\` from the machine's initial state, stopping if an event has no transition. */\r
export function walkStates(machine: StateMachine, events: string[]): StateStep[] {\r
  const steps: StateStep[] = [];\r
  let state = machine.initial;\r
  for (const event of events) {\r
    const next = machine.transitions[state]?.[event] ?? null;\r
    steps.push({ state, event, next });\r
    if (next == null) break;\r
    state = next;\r
  }\r
  steps.push({ state, event: null, next: null });\r
  return steps;\r
}\r
\r
/** The canonical client active-open → data → active-close lifecycle (real transitions). */\r
export const TCP_CLIENT_LIFECYCLE = ['send-SYN', 'recv-SYN+ACK', 'close', 'recv-ACK', 'recv-FIN', 'timeout'];\r
\r
/** Find the first layer in a tree that declares a state machine (e.g. TCP). */\r
export function findStateful(\r
  tree: DissectionNode,\r
): { machine: StateMachine; conversation?: ConversationSpec; name: string } | null {\r
  for (let n: DissectionNode | null = tree; n; n = n.child) {\r
    if (n.header.spec.states) {\r
      return { machine: n.header.spec.states, conversation: n.header.spec.conversation, name: n.header.spec.name };\r
    }\r
  }\r
  return null;\r
}\r
`;export{e as default};