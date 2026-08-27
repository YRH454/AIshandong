var e=`// Derive the live seq/ack numbers for each step of a conversation, given the\r
// real payload length. Relative to each side's ISN (= 0), exactly as a sequence\r
// diagram shows them. Pure and testable; the lifecycle view renders these.\r
//   SYN and FIN each consume one sequence number; a data segment consumes its\r
//   payload length; a pure ACK consumes none. A sender's ack = the next byte it\r
//   expects from the peer (the peer's current sequence position).\r
import type { ConversationStep } from '../core/types';\r
\r
export interface SeqPoint {\r
  seq: number;\r
  ack: number;\r
  ackValid: boolean; // is the ACK field meaningful (ACK flag set)?\r
  payload: number; // bytes of application data this segment carries\r
}\r
\r
const peer = (from: 'client' | 'server') => (from === 'client' ? 'server' : 'client');\r
\r
export function sequenceTrace(steps: ConversationStep[], payloadLen: number): SeqPoint[] {\r
  const next: Record<'client' | 'server', number> = { client: 0, server: 0 };\r
  return steps.map((s) => {\r
    const seq = next[s.from];\r
    const ack = next[peer(s.from)];\r
    const ackValid = !!s.flags && /ack/i.test(s.flags);\r
    const payload = s.advance === 'data' ? payloadLen : 0;\r
    const consume = s.advance === 'syn' || s.advance === 'fin' ? 1 : s.advance === 'data' ? payloadLen : 0;\r
    next[s.from] += consume;\r
    return { seq, ack, ackValid, payload };\r
  });\r
}\r
`;export{e as default};