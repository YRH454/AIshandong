var e=`// Linux capabilities — root's power split into ~40 independent bits, so a process can hold exactly the ones it needs\r
// and nothing else. This is coarser than seccomp (which filters individual syscalls): a capability is a whole class of\r
// privileged operation. The model is deliberately simple and exactly matches the kernel's check: an operation is\r
// permitted iff the process holds the capability it requires (or the operation needs no privilege at all). The point of\r
// the section is least privilege — a web server needs only CAP_NET_BIND_SERVICE to bind :80; grant it full root and an\r
// exploit inherits every dangerous power too.\r
\r
export interface Cap { id: string; label: string; allows: string }\r
export interface Op { id: string; label: string; cap: string | null; danger: boolean; detail: string }\r
\r
// A representative slice of the real capability set (there are ~40).\r
export const CAPS: Cap[] = [\r
  { id: 'CAP_NET_BIND_SERVICE', label: 'NET_BIND_SERVICE', allows: 'bind to ports below 1024' },\r
  { id: 'CAP_CHOWN', label: 'CHOWN', allows: 'change any file’s owner' },\r
  { id: 'CAP_DAC_OVERRIDE', label: 'DAC_OVERRIDE', allows: 'bypass file permission checks' },\r
  { id: 'CAP_NET_RAW', label: 'NET_RAW', allows: 'open raw/packet sockets' },\r
  { id: 'CAP_SETUID', label: 'SETUID', allows: 'become any user, including root' },\r
  { id: 'CAP_KILL', label: 'KILL', allows: 'signal any process' },\r
  { id: 'CAP_SYS_MODULE', label: 'SYS_MODULE', allows: 'load/unload kernel modules' },\r
  { id: 'CAP_SYS_ADMIN', label: 'SYS_ADMIN', allows: 'mount, namespaces — the “new root”' },\r
];\r
\r
// What the (exploited) web server might try to do. The first two are its legitimate job; the rest are what an attacker\r
// would attempt after popping a shell in it.\r
export const OPS: Op[] = [\r
  { id: 'bind80', label: 'bind port :80', cap: 'CAP_NET_BIND_SERVICE', danger: false, detail: 'the server’s actual job — serve HTTP on the privileged port' },\r
  { id: 'readcfg', label: 'read its own /app/config', cap: null, danger: false, detail: 'no privilege needed — the file is owned by the app user' },\r
  { id: 'shadow', label: 'read /etc/shadow', cap: 'CAP_DAC_OVERRIDE', danger: true, detail: 'bypass permissions to steal password hashes' },\r
  { id: 'chown', label: 'chown a file to root', cap: 'CAP_CHOWN', danger: true, detail: 'plant a root-owned setuid binary' },\r
  { id: 'sniff', label: 'sniff the network', cap: 'CAP_NET_RAW', danger: true, detail: 'raw sockets to capture or spoof traffic' },\r
  { id: 'setuid0', label: 'become root (setuid 0)', cap: 'CAP_SETUID', danger: true, detail: 'drop the app user and run as root' },\r
  { id: 'rootkit', label: 'load a kernel module', cap: 'CAP_SYS_MODULE', danger: true, detail: 'insert a rootkit into the kernel' },\r
  { id: 'escape', label: 'mount / escape the container', cap: 'CAP_SYS_ADMIN', danger: true, detail: 'the catch-all cap that breaks isolation' },\r
];\r
\r
// The kernel's check: allowed iff the op needs no capability, or the process holds the one it needs.\r
export function permits(held: Set<string>, op: Op): boolean {\r
  return op.cap === null || held.has(op.cap);\r
}\r
\r
// The one capability the app legitimately needs (least privilege = exactly this).\r
export const NEEDED = 'CAP_NET_BIND_SERVICE';\r
\r
export interface Verdict { kind: 'least' | 'over' | 'broken' | 'idle'; text: string }\r
\r
export function assess(held: Set<string>): Verdict {\r
  if (!held.has(NEEDED)) {\r
    return { kind: 'broken', text: 'The server can’t bind :80 without CAP_NET_BIND_SERVICE — it won’t even start. Dropping every capability is too far.' };\r
  }\r
  const dangerHeld = OPS.filter((o) => o.danger && o.cap && held.has(o.cap));\r
  if (dangerHeld.length === 0) {\r
    return { kind: 'least', text: 'Least privilege: the server binds :80 and literally nothing dangerous is possible. Pop a shell in it and the attacker is boxed in — this is why you drop every capability but the one you need.' };\r
  }\r
  const worst = dangerHeld[dangerHeld.length - 1];\r
  return { kind: 'over', text: \`Over-privileged: the process holds \${dangerHeld.length} dangerous capabilit\${dangerHeld.length === 1 ? 'y' : 'ies'} it never uses. An exploit could \${worst.detail.toLowerCase()}. Full root grants all of them at once.\` };\r
}\r
\r
export const ALL_CAPS = (): Set<string> => new Set(CAPS.map((c) => c.id));\r
export const LEAST_PRIVILEGE = (): Set<string> => new Set([NEEDED]);\r
`;export{e as default};