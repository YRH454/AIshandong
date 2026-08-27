var e=`// PID controller — the feedback loop that quietly runs the physical and digital world: cruise control,\r
// thermostats, drone stabilization, disk-head positioning, and, increasingly, software autoscaling and\r
// congestion control. The setup is universal: you have a PROCESS whose output you measure (speed, temperature,\r
// queue depth, replica count), a SETPOINT you want it to hold, and a knob (the control signal) that pushes it.\r
// A PID controller decides the knob from the ERROR e = setpoint − measured, as the sum of three terms:\r
//   P — proportional: push in proportion to how far off you are (Kp·e). Fast, but alone it leaves a permanent\r
//       "droop" — a steady-state error, because to hold the output against a constant load it needs a nonzero\r
//       control signal, which requires a nonzero error.\r
//   I — integral: accumulate the error over time (Ki·∫e). This is what ERASES the steady-state error — it keeps\r
//       winding up until the output exactly hits the setpoint — at the cost of possible overshoot and "windup."\r
//   D — derivative: react to how fast the error is changing (Kd·de/dt). It anticipates and DAMPS overshoot and\r
//       oscillation, acting like a shock absorber, but amplifies measurement noise.\r
// Tuning Kp, Ki, Kd trades responsiveness against stability. This models a SECOND-ORDER plant (a positioning\r
// system: control force → acceleration → velocity → position, with light natural damping), the classic PID\r
// testbed — so P alone overshoots and oscillates, D damps that oscillation (it opposes velocity), and I erases\r
// the steady-state droop against a constant load. Reference: Åström & Murray, "Feedback Systems";\r
// Ziegler–Nichols tuning (1942).\r
\r
const DAMPING = 0.8; // the plant's own light damping\r
\r
export interface PIDConfig { kp: number; ki: number; kd: number; setpoint: number; load: number; steps: number; dt: number }\r
export interface Sample { t: number; x: number; u: number; e: number }\r
export interface PIDResult { series: Sample[]; steadyError: number; overshoot: number; settleStep: number; finalX: number }\r
\r
export function simulate(cfg: PIDConfig): PIDResult {\r
  const { kp, ki, kd, setpoint, load, steps, dt } = cfg;\r
  let x = 0, v = 0, integral = 0, prevE = setpoint - x;\r
  const series: Sample[] = [];\r
  for (let t = 0; t < steps; t++) {\r
    const e = setpoint - x;\r
    integral += e * dt;\r
    const d = (e - prevE) / dt;\r
    const u = kp * e + ki * integral + kd * d;   // the PID control law\r
    series.push({ t, x, u, e });\r
    v = v + dt * (u - load - DAMPING * v);        // second-order plant: force → acceleration → velocity → position\r
    x = x + dt * v;\r
    prevE = e;\r
  }\r
  const finalX = x;\r
  const steadyError = setpoint - finalX;\r
  const overshoot = Math.max(0, Math.max(...series.map((s) => s.x)) - setpoint);\r
  const band = Math.abs(setpoint) * 0.02 + 1e-9;  // 2% settling band\r
  let settleStep = steps;\r
  for (let t = 0; t < series.length; t++) {\r
    if (series.slice(t).every((s) => Math.abs(s.x - setpoint) <= band)) { settleStep = t; break; }\r
  }\r
  return { series, steadyError, overshoot, settleStep, finalX };\r
}\r
`;export{e as default};