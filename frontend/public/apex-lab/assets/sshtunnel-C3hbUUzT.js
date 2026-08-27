var e=`// SSH tunnels / port forwarding — the -L / -R / -D distinction everyone gets backwards. An SSH connection can carry\r
// other TCP streams; the only real questions are WHICH side the listening port opens on and WHICH side makes the final\r
// hop to the target. -L (local) opens a port on YOUR machine and the server makes the last hop — reach a service the\r
// server can see but you can't. -R (remote) is the mirror: the port opens on the SERVER and your machine makes the last\r
// hop — expose your local service to the remote side. -D opens a SOCKS proxy on your machine and the server connects to\r
// whatever each request names. This derives the listener side, the hop path, the exact command, and whether it meets\r
// the goal — the model behind the visualization.\r
\r
export type Forward = 'L' | 'R' | 'D';\r
// The two things people actually want, which -L and -R respectively solve (and swapping them is the classic mistake).\r
export type Goal = 'reach-internal' | 'expose-local';\r
\r
export interface Hop { node: 'laptop' | 'tunnel' | 'server'; text: string }\r
export interface Plan {\r
  cmd: string;\r
  listener: { side: 'laptop' | 'server'; text: string };\r
  hops: Hop[];\r
  ok: boolean;\r
  reason: string;\r
}\r
\r
const DB = 'db.internal:5432';   // a service on the server's private network — reachable from the server, not from you\r
const APP = 'localhost:3000';    // a dev app on your laptop — reachable from you, not from the outside\r
\r
export function plan(forward: Forward, goal: Goal): Plan {\r
  if (goal === 'reach-internal') {\r
    if (forward === 'L') return {\r
      cmd: \`ssh -L 5432:\${DB} user@bastion\`,\r
      listener: { side: 'laptop', text: 'laptop :5432' },\r
      hops: [\r
        { node: 'laptop', text: 'your client connects to localhost:5432' },\r
        { node: 'tunnel', text: 'carried inside the SSH connection to the bastion' },\r
        { node: 'server', text: \`bastion opens the final hop to \${DB}\` },\r
      ],\r
      ok: true,\r
      reason: \`-L opens the port on YOUR side and the bastion makes the last hop, so you reach \${DB} — which only the bastion can see — as if it were localhost:5432.\`,\r
    };\r
    if (forward === 'R') return {\r
      cmd: \`ssh -R 5432:\${DB} user@bastion\`,\r
      listener: { side: 'server', text: 'bastion :5432' },\r
      hops: [\r
        { node: 'server', text: 'the port opens on the BASTION, not on you' },\r
        { node: 'tunnel', text: 'anything hitting it is carried back to your laptop' },\r
        { node: 'laptop', text: \`your laptop tries to reach \${DB} — but it can't\` },\r
      ],\r
      ok: false,\r
      reason: \`Wrong direction. -R opens the listener on the bastion and makes YOUR laptop do the final hop — but the database lives on the bastion's network, not yours. You wanted -L.\`,\r
    };\r
    return { // -D\r
      cmd: \`ssh -D 1080 user@bastion\`,\r
      listener: { side: 'laptop', text: 'laptop :1080 (SOCKS)' },\r
      hops: [\r
        { node: 'laptop', text: 'a SOCKS-aware client points at localhost:1080' },\r
        { node: 'tunnel', text: 'each request is carried to the bastion' },\r
        { node: 'server', text: \`bastion resolves and connects to \${DB} (or any host)\` },\r
      ],\r
      ok: true,\r
      reason: \`-D also works and is more general: a SOCKS proxy lets the bastion reach ANY destination it can see, \${DB} included — but the app must be pointed at the proxy, where -L just gives you a plain local port.\`,\r
    };\r
  }\r
  // goal === 'expose-local'\r
  if (forward === 'R') return {\r
    cmd: \`ssh -R 8080:\${APP} user@bastion\`,\r
    listener: { side: 'server', text: 'bastion :8080' },\r
    hops: [\r
      { node: 'server', text: 'someone on the bastion connects to bastion:8080' },\r
      { node: 'tunnel', text: 'carried back through the SSH connection to you' },\r
      { node: 'laptop', text: \`your laptop makes the final hop to \${APP}\` },\r
    ],\r
    ok: true,\r
    reason: \`-R opens the listener on the bastion and tunnels it back to you, so a remote user hits bastion:8080 and reaches your laptop's \${APP} — a reverse tunnel out through a machine you can't accept inbound connections on directly.\`,\r
  };\r
  if (forward === 'L') return {\r
    cmd: \`ssh -L 8080:\${APP} user@bastion\`,\r
    listener: { side: 'laptop', text: 'laptop :8080' },\r
    hops: [\r
      { node: 'laptop', text: 'the port opens on YOUR laptop, not the bastion' },\r
      { node: 'tunnel', text: '…which no one on the remote side can reach' },\r
    ],\r
    ok: false,\r
    reason: \`Wrong direction. -L opens the port on your own machine, so it can't let a remote user reach in. To publish your local app you need -R, which opens the listener on the bastion.\`,\r
  };\r
  return { // -D\r
    cmd: \`ssh -D 1080 user@bastion\`,\r
    listener: { side: 'laptop', text: 'laptop :1080 (SOCKS)' },\r
    hops: [{ node: 'laptop', text: 'a SOCKS proxy is an OUTBOUND client proxy' }],\r
    ok: false,\r
    reason: \`-D is an outbound proxy for your own traffic — it can't publish a service inbound. Use -R to expose your local app.\`,\r
  };\r
}\r
`;export{e as default};