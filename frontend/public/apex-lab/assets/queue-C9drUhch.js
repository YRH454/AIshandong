var e=`// M/M/1 queueing — the math behind "you can't fill the pipe without latency". Packets\r
// arrive at rate λ (Poisson) and a link serves them at rate μ; the utilisation is\r
// ρ = λ/μ. The mean time a packet spends in the system is W = 1/(μ−λ), which blows up\r
// as ρ→1: at 50% load the wait is two service times, at 90% it's ten, at 99% a hundred.\r
// That 1/(1−ρ) knee is why operators target ~70% and why bufferbloat hurts — a bigger\r
// buffer doesn't raise μ, it just lets the queue (and the delay) grow. Standard\r
// closed-form results (Little's law etc.), verified.\r
\r
export interface MM1 {\r
  rho: number; // utilisation λ/μ\r
  stable: boolean; // ρ < 1 ?\r
  L: number; // mean packets in the system\r
  Lq: number; // mean packets waiting in the queue\r
  W: number; // mean time in system (queue + service)\r
  Wq: number; // mean time waiting in the queue\r
}\r
\r
export function mm1(lambda: number, mu: number): MM1 {\r
  const rho = mu > 0 ? lambda / mu : Infinity;\r
  if (!(rho < 1) || mu <= 0) {\r
    return { rho, stable: false, L: Infinity, Lq: Infinity, W: Infinity, Wq: Infinity };\r
  }\r
  return {\r
    rho,\r
    stable: true,\r
    L: rho / (1 - rho), // = λW (Little's law)\r
    Lq: (rho * rho) / (1 - rho),\r
    W: 1 / (mu - lambda),\r
    Wq: rho / (mu - lambda),\r
  };\r
}\r
\r
/** Mean system time as a multiple of one service time, vs utilisation — the 1/(1−ρ) curve. */\r
export const latencyFactor = (rho: number): number => (rho < 1 ? 1 / (1 - rho) : Infinity);\r
`;export{e as default};