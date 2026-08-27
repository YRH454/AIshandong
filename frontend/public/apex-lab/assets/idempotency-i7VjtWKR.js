var e=`// Idempotency keys — how an API makes a non-idempotent operation (POST /charge) safe to retry, turning\r
// at-least-once delivery into exactly-once EFFECT. Networks drop responses, so clients retry; without\r
// protection a retried "charge $100" charges twice. The fix: the client attaches a unique idempotency\r
// key, and the server records (key → result) the first time it runs the operation. A retry with the same\r
// key returns the STORED result without re-executing — no second charge. A second request with the same\r
// key while the first is still running is a CONFLICT (the client should back off and retry). Stripe,\r
// PayPal and most payment APIs require this. Reference: Stripe API idempotency; IETF idempotency-key draft.\r
\r
export type Outcome = 'charged' | 'replayed' | 'conflict' | 'charged-unsafe';\r
export interface Result { chargeId: number; amount: number }\r
export interface HandleResult { outcome: Outcome; result: Result | null; charges: number; total: number }\r
\r
export class PaymentService {\r
  private store = new Map<string, { state: 'inprogress' | 'completed'; result?: Result }>();\r
  charges = 0;   // number of times the side effect actually fired\r
  total = 0;     // total amount charged\r
  private nextId = 1;\r
\r
  /** Process a charge. With an idempotency key, a retry is deduplicated; without one, every call charges. */\r
  handle(key: string | null, amount: number): HandleResult {\r
    if (key === null) { // no key → no dedup possible (the unsafe path)\r
      this.charges++; this.total += amount;\r
      return { outcome: 'charged-unsafe', result: { chargeId: this.nextId++, amount }, charges: this.charges, total: this.total };\r
    }\r
    const rec = this.store.get(key);\r
    if (rec?.state === 'completed') return { outcome: 'replayed', result: rec.result!, charges: this.charges, total: this.total };\r
    if (rec?.state === 'inprogress') return { outcome: 'conflict', result: null, charges: this.charges, total: this.total };\r
\r
    this.store.set(key, { state: 'inprogress' });          // claim the key before doing the work\r
    this.charges++; this.total += amount;                  // the side effect — exactly once per key\r
    const result: Result = { chargeId: this.nextId++, amount };\r
    this.store.set(key, { state: 'completed', result });\r
    return { outcome: 'charged', result, charges: this.charges, total: this.total };\r
  }\r
\r
  /** Simulate the first attempt timing out (response lost) and the client retrying with the same key. */\r
  beginInProgress(key: string) { this.store.set(key, { state: 'inprogress' }); }\r
}\r
`;export{e as default};