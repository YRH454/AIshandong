var e=`// Container networking from the bytes up: network namespaces, veth pairs, a bridge, and NAT. Each container lives in\r
// its own network namespace with its own eth0 and IP. A veth pair is a virtual cable: one end is the container's eth0,\r
// the other is plugged into a Linux bridge on the host (docker0) that acts as a virtual switch. Containers on the SAME\r
// bridge reach each other directly at L2 with their private IPs — no NAT. To reach the internet the host MASQUERADEs\r
// (source-NAT): it rewrites the container's private RFC1918 source address to the host's routable IP so the reply can\r
// find its way back. Turn that off and the container is stranded. This computes the hop path + rewrites + verdict.\r
\r
export interface Container { name: string; ip: string; bridge: string }\r
export interface Topology {\r
  containers: Container[];\r
  hostPublicIp: string;   // the host's routable address (what MASQUERADE rewrites to)\r
  masquerade: boolean;    // is SNAT/MASQUERADE enabled for egress to the internet?\r
}\r
\r
export const INTERNET_IP = '93.184.216.34'; // example.com — a public destination outside every bridge\r
\r
export interface Hop { where: string; src: string; dst: string; rewrite?: boolean; note?: string }\r
export interface Result { hops: Hop[]; ok: boolean; reason: string }\r
\r
const isPrivate = (ip: string) => /^(10\\.|192\\.168\\.|172\\.(1[6-9]|2\\d|3[01])\\.)/.test(ip);\r
\r
// Send an IP packet from a container to another container (by name) or to the internet (INTERNET_IP).\r
export function send(topo: Topology, fromName: string, dstIpOrName: string): Result {\r
  const from = topo.containers.find((c) => c.name === fromName);\r
  if (!from) return { hops: [], ok: false, reason: \`no container named \${fromName}\` };\r
\r
  // Destination is another container?\r
  const target = topo.containers.find((c) => c.name === dstIpOrName || c.ip === dstIpOrName);\r
  if (target) {\r
    const hops: Hop[] = [{ where: \`\${from.name}:eth0\`, src: from.ip, dst: target.ip }];\r
    if (target.bridge === from.bridge) {\r
      hops.push({ where: \`\${from.bridge} (bridge)\`, src: from.ip, dst: target.ip, note: 'L2 switch — forwarded by MAC' });\r
      hops.push({ where: \`\${target.name}:eth0\`, src: from.ip, dst: target.ip });\r
      return { hops, ok: true, reason: \`Same bridge (\${from.bridge}): the two eth0s share one L2 domain, so the bridge forwards the frame by MAC. Private IPs unchanged — no NAT.\` };\r
    }\r
    // different bridge: the bridge floods within its own domain only, and nothing routes between the two subnets\r
    hops.push({ where: \`\${from.bridge} (bridge)\`, src: from.ip, dst: target.ip, note: \`\${target.ip} is not on this bridge\` });\r
    return { hops, ok: false, reason: \`\${target.name} is on a different bridge (\${target.bridge}). A bridge only switches within its own L2 domain, and no route connects the two subnets — the packet is dropped. Isolation by design.\` };\r
  }\r
\r
  // Otherwise: egress to the internet.\r
  const dst = dstIpOrName;\r
  const hops: Hop[] = [\r
    { where: \`\${from.name}:eth0\`, src: from.ip, dst },\r
    { where: \`\${from.bridge} (bridge)\`, src: from.ip, dst, note: 'up to the host' },\r
  ];\r
  if (topo.masquerade) {\r
    hops.push({ where: 'host eth0 (MASQUERADE)', src: topo.hostPublicIp, dst, rewrite: true, note: \`SNAT: \${from.ip} → \${topo.hostPublicIp}\` });\r
    hops.push({ where: 'the internet', src: topo.hostPublicIp, dst });\r
    return { hops, ok: true, reason: \`MASQUERADE rewrote the private source \${from.ip} to the host's routable \${topo.hostPublicIp}. The reply comes back to the host, which un-NATs it to \${from.ip}. That one iptables rule is the whole reason containers can browse the web.\` };\r
  }\r
  hops.push({ where: 'host eth0 (no SNAT)', src: from.ip, dst, note: \`source still \${from.ip}\` });\r
  hops.push({ where: 'the internet', src: from.ip, dst, note: 'reply has nowhere to go' });\r
  return {\r
    hops, ok: false,\r
    reason: \`Without MASQUERADE the source stays \${from.ip} — a \${isPrivate(from.ip) ? 'private RFC1918' : 'non-routable'} address. The request may leave, but the reply is addressed to \${from.ip}, which no router on the internet will carry back. The container is stranded.\`,\r
  };\r
}\r
`;export{e as default};