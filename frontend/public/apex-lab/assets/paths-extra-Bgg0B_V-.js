var e=`// Guided journeys, part 2 — split out of paths.ts so each file stays reviewable (< 800 lines).\r
// The LearningPath contract lives in paths.ts; PATHS there is CORE_PATHS + EXTRA_PATHS.\r
import type { LearningPath } from './paths';\r
\r
export const EXTRA_PATHS: LearningPath[] = [\r
  {\r
    id: 'noisychannel',\r
    title: 'How bits survive a noisy channel',\r
    icon: '📡',\r
    blurb: 'A wire carries voltage, not bits, and it corrupts what it carries. Follow a message down the stack: turned into a signal, framed into packets, checked for corruption, and — when noise still wins — repaired in place without asking for a resend.',\r
    steps: [\r
      { id: 'linecode', note: 'First bits become a physical signal — voltage levels and transitions. A good line code (Manchester, 8b/10b) keeps the receiver’s clock recoverable and the line DC-balanced.' },\r
      { id: 'cobs', note: 'The receiver must find where each packet ends. COBS byte-stuffing removes every zero byte so a lone zero can mark the boundary unambiguously — framing at almost no cost.' },\r
      { id: 'crc32', note: 'Noise flips bits in transit. A CRC treats the message as a polynomial and divides by a fixed one; the remainder is a checksum that catches virtually all real-world errors cheaply.' },\r
      { id: 'hamming', note: 'Detection only means “resend.” To fix a single flipped bit in place, add parity bits: Hamming(7,4) pinpoints exactly which bit went wrong and flips it back.' },\r
      { id: 'reedsolomon', note: 'Real channels corrupt whole bursts — scratches, fades, dead pixels. Reed–Solomon works over polynomials to correct bursts and erasures; it’s in CDs, QR codes, and deep-space links.' },\r
    ],\r
  },\r
  {\r
    id: 'hashing',\r
    title: 'Where does this key go? (hashing)',\r
    icon: '🪣',\r
    blurb: 'A hash turns a key into a location. Start with one table and its collisions, tighten the worst-case lookup, then scale the same question across a whole cluster — where adding or removing a server should move as few keys as possible.',\r
    steps: [\r
      { id: 'hashtable', note: 'Turn a key into a bucket index with a hash, and handle two keys landing in the same bucket — collisions — by chaining or probing. The O(1)-average lookup behind every dictionary.' },\r
      { id: 'cuckoo', note: 'Guarantee O(1) worst-case lookup: each key lives in one of just two buckets, and inserting kicks the current occupant to its alternate slot, cuckoo-style, until everyone fits.' },\r
      { id: 'robinhood', note: 'Even out probe lengths in open addressing: if you’ve probed further than the key you’re looking at, steal its slot and push it onward — robbing the rich to help the poor, so the worst lookup stays short.' },\r
      { id: 'chash', note: 'Now spread keys across many servers so adding or removing one moves only ~1/N of keys, not all of them: consistent hashing places servers and keys on a ring.' },\r
      { id: 'jumphash', note: 'A memoryless consistent hash: map a key to one of N shards with a tiny loop — no ring, no table — so growing N by one moves only the keys that should move.' },\r
      { id: 'rendezvous', note: 'Highest-Random-Weight: score a key against every node and pick the top — no ring, an even spread, and the full ranking doubles as a replica preference list.' },\r
    ],\r
  },\r
  {\r
    id: 'balanced',\r
    title: 'Keeping search O(log n) (balanced structures)',\r
    icon: '⚖️',\r
    blurb: 'A plain binary search tree degrades to a linked list on sorted input. Five different strategies keep search logarithmic — strict rotations, randomness, self-adjustment, coin-flip lanes, and a heap-BST hybrid.',\r
    steps: [\r
      { id: 'avl', note: 'The strict way: after each insert, rotate so no node’s two subtrees differ in height by more than 1 — a guaranteed O(log n) height, paid for with rebalancing on every change.' },\r
      { id: 'treap', note: 'The lazy way: give each key a random priority and keep a heap on priorities atop the BST on keys. Random priorities balance the tree in expectation, with no explicit balance rules.' },\r
      { id: 'splaytree', note: 'The adaptive way: don’t balance by height at all — splay every accessed node to the root, so recently-used keys stay near the top and hot workloads run fast (amortized O(log n)).' },\r
      { id: 'skiplist', note: 'Drop the tree: stack sorted linked lists with coin-flip express lanes; a search rides the top lane down — O(log n) expected with far simpler code (it’s inside Redis and LevelDB).' },\r
      { id: 'cartesian', note: 'The dual view: a tree that’s a BST on position and a heap on value at once, so range-minimum queries become lowest-common-ancestor lookups — two classic problems, one structure.' },\r
    ],\r
  },\r
  {\r
    id: 'routingpaths',\r
    title: 'How packets find their way (routing)',\r
    icon: '🗺️',\r
    blurb: 'A packet carries a destination, not a route. Follow how each hop decides where to send it — the forwarding lookup, the two ways routers learn paths, inter-domain policy, and the trust gap that lets traffic be hijacked.',\r
    steps: [\r
      { id: 'lpm', note: 'The per-hop decision: a router matches the destination against its table and picks the most specific (longest) prefix — the single lookup every packet triggers at every hop.' },\r
      { id: 'distvec', note: 'How routers learn routes without a map: each tells neighbors its distance to every destination and they keep the best — simple, but prone to slow count-to-infinity when a link fails.' },\r
      { id: 'ospf', note: 'The link-state alternative: every router floods the whole topology to everyone, then each runs Dijkstra on the identical map — fast convergence, at the cost of flooding.' },\r
      { id: 'bgp', note: 'Between autonomous systems it’s policy, not shortest path: BGP advertises AS-paths and each network picks by business rules, then forwards along the chosen one.' },\r
      { id: 'bgphijack', note: 'BGP trusts what it’s told, so a network announcing a prefix it doesn’t own can pull the world’s traffic to itself — the routing attack behind real outages and interceptions.' },\r
      { id: 'anycast', note: 'One IP announced from many locations at once; ordinary routing delivers each user to the nearest instance — how DNS roots and CDNs are everywhere at the same address.' },\r
    ],\r
  },\r
  {\r
    id: 'curvesigs',\r
    title: 'Signing on elliptic curves',\r
    icon: '🔏',\r
    blurb: 'Elliptic curves give a group where signatures are short and forgery is hard. Follow how curve signatures evolved — from the standard with its dangerous nonce, to deterministic, linear, aggregatable, and finally split-across-parties.',\r
    steps: [\r
      { id: 'ecc', note: 'The setting: adding points on an elliptic curve forms a group where a scalar times a point is easy but recovering the scalar (discrete log) is hard — far smaller keys than RSA for the same strength.' },\r
      { id: 'ecdsa', note: 'The standard curve signature (Bitcoin, TLS) — but it needs a fresh random nonce per signature, and a repeated or biased one leaks the private key outright.' },\r
      { id: 'eddsa', note: 'The modern fix: Ed25519 derives the nonce deterministically from the key and message, so a broken RNG can’t leak the key — fast and misuse-resistant.' },\r
      { id: 'schnorr', note: 'The idea underneath signatures: Schnorr’s three-move zero-knowledge proof shows you know the secret x behind Y = xG without revealing it — Fiat–Shamir turns that into a signature, and its linearity is what lets keys add into multisignatures (MuSig, Taproot).' },\r
      { id: 'bls', note: 'Go further with a pairing: BLS aggregates any number of signatures — even on different messages — into a single short one, verified in one shot (Ethereum consensus).' },\r
      { id: 'threshsig', note: 'Split the private key so no one holds it: any k of n parties jointly produce a valid signature but fewer cannot — threshold signing for custody and validators.' },\r
    ],\r
  },\r
  {\r
    id: 'dnssystem',\r
    title: 'The name system and its attacks',\r
    icon: '🏷️',\r
    blurb: 'Turning a name into an IP is a cached, trusting, plaintext lookup — which makes it a target. Follow the resolution, the classic cache-poisoning attack, the two things that harden it (signing and encryption), and two ways attackers still abuse names.',\r
    steps: [\r
      { id: 'dns', note: 'The lookup: a name becomes an IP by walking root → TLD → authoritative, and the answer is cached at every resolver along the way — which is exactly what makes it worth attacking.' },\r
      { id: 'kaminsky', note: 'Poison that cache: guess the query’s 16-bit ID and race a forged answer to the resolver before the real one arrives — the 2008 Kaminsky attack that forced source-port randomization.' },\r
      { id: 'dnssec', note: 'Sign the answers: a chain of signatures from the root down lets a resolver cryptographically reject forged records — authentication for DNS (but not encryption).' },\r
      { id: 'encdns', note: 'Hide the query: DoH/DoT wrap DNS in TLS so the network can’t see which names you look up or tamper with the reply — encryption, where DNSSEC only signs.' },\r
      { id: 'dnsrebind', note: 'Turn the browser into a proxy: after a page loads, rebind its hostname to 127.0.0.1 so the same-origin policy now lets the page talk to services on the victim’s own network.' },\r
      { id: 'subdomain', note: 'The dangling pointer: a DNS record still aimed at a deprovisioned cloud resource lets whoever re-registers that resource serve content as your subdomain.' },\r
    ],\r
  },\r
  {\r
    id: 'lockfree',\r
    title: 'Coordinating threads without locks',\r
    icon: '🔀',\r
    blurb: 'A mutex is easy to get wrong and slow when contended. Walk from a correct lock built from plain reads and writes, to a fast one, to lock-free reads, to readers that never block — and the subtle bug lurking underneath it all.',\r
    steps: [\r
      { id: 'bakery', note: 'A correct mutex from nothing but reads and writes: take a numbered ticket like a bakery queue and wait until you hold the lowest — Lamport’s proof that mutual exclusion needs no special hardware.' },\r
      { id: 'futex', note: 'The fast path: when a lock is uncontended, spin on an atomic in userspace and never enter the kernel; only call futex to sleep when you actually have to block. The mutex behind pthreads.' },\r
      { id: 'seqlock', note: 'Lock-free reads: a writer bumps a sequence counter around its update and a reader retries if it changed mid-read — perfect for rarely-written, often-read data like the kernel clock.' },\r
      { id: 'rcu', note: 'Readers that never block: read-copy-update publishes a new version and defers freeing the old copy until every pre-existing reader has finished — how Linux scales read-mostly structures across many cores.' },\r
      { id: 'aba', note: 'The lock-free trap: a compare-and-swap sees the same pointer value and assumes nothing changed — but it was freed and reallocated in between (ABA), corrupting the structure. Fixed with version tags or hazard pointers.' },\r
    ],\r
  },\r
  {\r
    id: 'tcptuning',\r
    title: 'TCP’s finer points',\r
    icon: '🛠️',\r
    blurb: 'The handshake and retransmission are only the start. These are the refinements and edge cases that decide how TCP actually behaves in production — from batching tiny writes to spreading one connection across two networks.',\r
    steps: [\r
      { id: 'nagle', note: 'Batch small writes: Nagle holds a tiny segment until the previous one is ACKed, coalescing keystrokes into fewer packets — but its interaction with delayed ACKs can stall a request 40–200 ms.' },\r
      { id: 'sws', note: 'Silly window syndrome: a slow reader advertising tiny windows and an eager sender filling them collapse a connection into a flood of runt segments — cured by Clark’s receiver rule and Nagle on the sender.' },\r
      { id: 'pmtud', note: 'Find the biggest packet that fits: Path MTU Discovery sends don’t-fragment probes and shrinks on the ICMP “too big” reply — and black-holes silently when a firewall eats those ICMPs.' },\r
      { id: 'tfo', note: 'Skip a round trip: TCP Fast Open carries data in the SYN using a server-issued cookie, so a repeat connection delivers the request before the handshake even finishes.' },\r
      { id: 'timewait', note: 'Why a closed socket lingers: the active closer holds TIME_WAIT for 2·MSL so a stray old segment can’t corrupt a new connection — which quietly exhausts ephemeral ports on a busy client.' },\r
      { id: 'mptcp', note: 'One connection, many paths: Multipath TCP spreads a single stream across wifi and cellular at once, surviving a path loss and pooling bandwidth — why a download survives leaving the house.' },\r
    ],\r
  },\r
  {\r
    id: 'disttime',\r
    title: 'Keeping time in a distributed system',\r
    icon: '⏱️',\r
    blurb: 'With no shared clock, machines disagree about “now” — and ordering events across them is a deep problem. Follow how systems synchronize physical time, bound its uncertainty, blend it with causality, and even use timing to decide who’s dead.',\r
    steps: [\r
      { id: 'ntp', note: 'Sync wall clocks over the network: NTP estimates the offset to a reference by timing a round trip and assuming symmetry — good to milliseconds, but never exact, and asymmetry skews it.' },\r
      { id: 'gps', note: 'The reference itself: GPS satellites carry atomic clocks, and your receiver solves for position AND precise time from the signal delays — the source many NTP servers ultimately trust.' },\r
      { id: 'truetime', note: 'Own the uncertainty instead of hiding it: Spanner’s TrueTime returns an interval [earliest, latest] for “now”, and commit-wait sleeps out that interval so transaction timestamps order globally.' },\r
      { id: 'hlc', note: 'Blend causality with the clock: Hybrid Logical Clocks track happened-before like a logical clock while staying within a bound of physical time — monotonic timestamps that also read like wall time.' },\r
      { id: 'phiaccrual', note: 'Turn timing into a verdict: the φ accrual failure detector scores how overdue a heartbeat is against its observed distribution, so “is that node dead?” becomes a tunable suspicion level, not a fixed timeout.' },\r
    ],\r
  },\r
  {\r
    id: 'physicsim',\r
    title: 'Simulating the physical world',\r
    icon: '⚛️',\r
    blurb: 'A physics or game engine turns forces into motion, keeps energy from leaking, scales to millions of bodies, and decides when things collide. Follow the pieces that make a simulated world move and touch.',\r
    steps: [\r
      { id: 'verlet', note: 'Move things by integrating forces: Verlet integration updates a particle from its last two positions, which makes stiff constraints (a rope’s links, a cloth’s grid) trivial to enforce — the backbone of game physics.' },\r
      { id: 'orbit', note: 'Keep energy from leaking: a naive integrator slowly spirals a stable orbit inward or outward, but a symplectic integrator conserves energy over millions of steps, so the planet keeps orbiting.' },\r
      { id: 'doublependulum', note: 'The limit of prediction: a double pendulum is fully deterministic yet chaotic — two runs a hair apart diverge exponentially, the same sensitivity that makes weather unforecastable past days.' },\r
      { id: 'barneshut', note: 'Scale to a galaxy: computing gravity between every pair is O(n²); the Barnes-Hut tree lumps a distant cluster into one mass, dropping it to O(n log n) with bounded error.' },\r
      { id: 'spatialhash', note: 'Find collision candidates fast: bucket objects into a grid by position so each one only tests its neighbors — skipping the O(n²) all-pairs check that dooms a naïve collision loop.' },\r
      { id: 'sat', note: 'Confirm the hit: the Separating Axis Theorem checks whether two convex shapes actually overlap by looking for a gap along any of their face normals — no separating axis means a collision.' },\r
    ],\r
  },\r
  {\r
    id: 'webattacks',\r
    title: 'How web apps get attacked (and defended)',\r
    icon: '🕳️',\r
    blurb: 'Most breaches aren’t exotic — they abuse a server that trusts input too much or a browser boundary that isn’t enforced. Six classic web-app attack classes, each shown sandboxed with the fix that closes it.',\r
    steps: [\r
      { id: 'ssrf', note: 'Make the server fetch for you: if an app requests a user-supplied URL, an attacker points it at internal services or cloud metadata (169.254.169.254) the outside can’t reach — closed by allow-lists and blocking link-local ranges.' },\r
      { id: 'xxe', note: 'Abuse the XML parser: a crafted external entity makes the parser read local files or make requests on the attacker’s behalf — closed by disabling external-entity resolution.' },\r
      { id: 'smuggle', note: 'Desync the pipeline: front-end and back-end disagree on where one request ends (Content-Length vs Transfer-Encoding), so a smuggled prefix poisons the next user’s response — closed by consistent parsing and HTTP/2.' },\r
      { id: 'openredirect', note: 'Borrow the site’s trust: an unvalidated redirect parameter sends users to an attacker’s page from a legitimate domain — the pivot in phishing and OAuth token theft, closed by allow-listing redirect targets.' },\r
      { id: 'clickjack', note: 'Steal the click: frame the real site invisibly over a decoy so a click on “win a prize” lands on “delete account” — closed by X-Frame-Options / frame-ancestors CSP.' },\r
      { id: 'protopollute', note: 'Poison the prototype: injecting a __proto__ key into a merged object writes onto every object’s prototype, flipping security checks — closed by null-prototype objects and rejecting __proto__ keys.' },\r
    ],\r
  },\r
  {\r
    id: 'graphalgos',\r
    title: 'Classic graph algorithms',\r
    icon: '🔗',\r
    blurb: 'So many problems are secretly a graph — dependencies, maps, networks, exchange rates. Six workhorse algorithms answer the recurring questions: order it, cluster it, connect it cheaply, find shortest paths, and push maximum flow.',\r
    steps: [\r
      { id: 'toposort', note: 'Order a DAG so every edge points forward: topological sort turns a graph of dependencies (build steps, course prereqs) into a valid linear schedule — or reports the cycle that makes one impossible.' },\r
      { id: 'scc', note: 'Find the tightly-knit clusters: a strongly connected component is a maximal set where every node reaches every other; condensing them collapses any directed graph into a DAG (Tarjan finds them in one DFS).' },\r
      { id: 'unionfind', note: 'Track connectivity as it grows: union-find answers “are these two in the same group?” in near-constant time with union-by-rank and path compression — the engine inside Kruskal and connected-components.' },\r
      { id: 'mst', note: 'Connect everything as cheaply as possible: a minimum spanning tree is the lowest-weight edge set that keeps the graph connected — Kruskal sorts edges and adds each unless it forms a cycle (checked with union-find).' },\r
      { id: 'bellmanford', note: 'Shortest paths even with negative edges: Bellman-Ford relaxes every edge V−1 times, and a further relaxation that still improves proves a negative cycle — which over exchange rates is an arbitrage loop.' },\r
      { id: 'maxflow', note: 'Push as much as the network allows: max-flow augments along residual paths until none remain, and the min-cut — the bottleneck edges — always equals the maximum flow.' },\r
    ],\r
  },\r
  {\r
    id: 'webtransport',\r
    title: 'How the web got faster (HTTP/2 → HTTP/3)',\r
    icon: '⚡',\r
    blurb: 'HTTP/1 opened a fresh connection per request and blocked on the slow ones. Follow the fixes — multiplexing, flow control, a new transport on UDP, connection migration, and zero-round-trip resumption — that turned the web fast.',\r
    steps: [\r
      { id: 'http2', note: 'One connection, many streams: HTTP/2 multiplexes independent requests over a single connection, so a big download no longer blocks small ones behind it — the first cure for HTTP/1’s head-of-line blocking.' },\r
      { id: 'h2flow', note: 'Share the pipe fairly: per-stream flow-control windows let the receiver throttle a firehose stream without stalling the others sharing the connection.' },\r
      { id: 'quic', note: 'But TCP still blocks: one lost packet stalls every HTTP/2 stream (transport head-of-line blocking). QUIC rebuilds the transport on UDP so each stream recovers independently — and folds in the TLS handshake for fewer round trips.' },\r
      { id: 'quicmig', note: 'Survive changing networks: QUIC names a connection by a connection ID, not the IP/port 4-tuple, so it keeps going as you walk from wifi onto cellular — where TCP would drop and reconnect.' },\r
      { id: 'zerortt', note: 'Send data in the first packet: on resumption, TLS 1.3 / QUIC 0-RTT ships the request before the handshake completes — a round trip saved, at the cost of a replay risk that needs idempotent handling.' },\r
      { id: 'http3', note: 'HTTP over QUIC: HTTP/3 carries the same HTTP semantics on QUIC, with QPACK header compression redesigned so a lost header block can’t stall unrelated streams — head-of-line blocking gone end to end.' },\r
    ],\r
  },\r
  {\r
    id: 'compgeom',\r
    title: 'Computational geometry',\r
    icon: '📐',\r
    blurb: 'Reasoning about points and shapes in the plane underlies maps, meshes, graphics, and simulation. Six algorithms: wrap a point set, triangulate it, partition around it, index it for nearest-neighbor, scatter points evenly, and trace a contour.',\r
    steps: [\r
      { id: 'convexhull', note: 'The tightest boundary: the convex hull is the shape a rubber band snaps to around a scatter of points — a sort plus a stack scan (Graham/Andrew) in O(n log n), the first step of countless geometry algorithms.' },\r
      { id: 'delaunay', note: 'The best triangulation: connect points into triangles so no point lies inside any triangle’s circumcircle, which maximizes the smallest angle and avoids slivers — the mesh behind terrain and finite-element grids.' },\r
      { id: 'voronoi', note: 'The dual partition: split the plane into one cell per point, each the region closest to that point. It’s the exact dual of the Delaunay triangulation — two points’ cells touch iff they’re Delaunay neighbors.' },\r
      { id: 'kdtree', note: 'Nearest neighbor, fast: a k-d tree recursively splits space on alternating axes, so a nearest-point query prunes whole half-spaces instead of scanning every point — O(log n) average in low dimensions.' },\r
      { id: 'poisson', note: 'Points that don’t clump: Poisson-disk sampling scatters random points no two closer than r apart (“blue noise”), the natural, even spread used for stippling, textures, and anti-aliasing.' },\r
      { id: 'marchsquares', note: 'From a field to a contour: marching squares walks a grid of scalar values and, cell by cell, draws the line where the field crosses a threshold — the 2D isoline, and the ancestor of marching cubes.' },\r
    ],\r
  },\r
  {\r
    id: 'authpath',\r
    title: 'Proving who you are online',\r
    icon: '🪪',\r
    blurb: 'Every login is a proof of identity — and each protocol makes that proof differently. Walk from the basic factors through a second factor, stateless tokens, enterprise single sign-on, server login, and proving which domain sent an email.',\r
    steps: [\r
      { id: 'identity', note: 'The landscape: authentication proves who you are, authorization decides what you may do. Factors are things you know (a password), have (a phone or key), or are (a fingerprint) — and combining kinds is what makes two-factor strong.' },\r
      { id: 'totp', note: 'A second factor from a shared secret: TOTP hashes a secret with the current 30-second time window (RFC 6238) into a 6-digit code, so your authenticator app and the server derive the same number without ever communicating.' },\r
      { id: 'jwt', note: 'A token trusted without a lookup: a JWT is a signed JSON claim the client carries, verified by signature alone — fast and stateless, but infamous for the alg=none and algorithm-confusion attacks when the verifier believes the token’s own header.' },\r
      { id: 'kerberos', note: 'Single sign-on with tickets: authenticate once to a key distribution center for a ticket-granting ticket, then exchange it for per-service tickets — proving identity to many services without resending your password.' },\r
      { id: 'ssh', note: 'Logging into a server: SSH authenticates you by public key (the server challenges, you sign) and authenticates the server by its host key, pinned on first use — the mutual check that stops a machine-in-the-middle.' },\r
      { id: 'mailauth', note: 'Proving a domain sent the mail: SPF lists which IPs may send for a domain and DKIM signs the message with the domain’s key, so a receiver can reject forgeries — the anti-phishing backbone, aligned by DMARC.' },\r
    ],\r
  },\r
  {\r
    id: 'numerics',\r
    title: 'Fast and careful arithmetic',\r
    icon: '🧮',\r
    blurb: 'Numbers on a computer are neither exact nor free. Follow how fractions are actually stored, how precision is lost and recovered, and the bit-level and divide-and-conquer tricks that make square roots, trig, and big multiplies fast.',\r
    steps: [\r
      { id: 'float', note: 'How a computer stores a fraction: IEEE-754 splits a number into sign, exponent, and mantissa — which is why 0.1 has no exact binary form and 0.1 + 0.2 ≠ 0.3. The representation every other numeric trick works within.' },\r
      { id: 'kahan', note: 'Careful summation: adding many floats drops the low bits of each step, so a long sum drifts; Kahan’s algorithm carries a running compensation term for what was lost, recovering near-full precision.' },\r
      { id: 'fastinvsqrt', note: 'The bit-level hack: Quake’s 1/√x reinterprets the float’s bits as an integer, subtracts that from 0x5f3759df to halve-and-negate the exponent, then refines with one Newton step — a reciprocal square root with no divide.' },\r
      { id: 'cordic', note: 'Trig with only shifts and adds: CORDIC rotates a vector by ever-smaller fixed angles, picking each direction by sign, to compute sine, cosine, and more — how calculators and FPGAs do trig with no multiplier.' },\r
      { id: 'karatsuba', note: 'Multiply big numbers faster: splitting each factor in half naively needs four sub-multiplies, but Karatsuba does it in three, turning O(n²) into O(n^1.585) — the first step beyond schoolbook multiplication.' },\r
      { id: 'ntt', note: 'Fast polynomial multiply: the number-theoretic transform is an FFT over a finite field — transform, multiply pointwise, transform back for O(n log n) products. The engine inside lattice crypto like Kyber.' },\r
    ],\r
  },\r
  {\r
    id: 'leaderless',\r
    title: 'A datastore with no leader',\r
    icon: '🌐',\r
    blurb: 'Dynamo-style stores (Cassandra, Riak) have no primary node — every peer is equal. Follow how a leaderless cluster locates keys, spreads news, detects failures, and stays consistent, all without a central coordinator.',\r
    steps: [\r
      { id: 'chord', note: 'Locate a key with no directory: Chord arranges nodes in a hash ring, each owning the keys up to its successor, and routes lookups in O(log n) hops with a finger table of exponentially-spaced shortcuts — a distributed hash table with no central index.' },\r
      { id: 'gossip', note: 'Spread news like a rumor: each node periodically tells a few random peers what it knows, so an update reaches everyone in O(log n) rounds — the epidemic protocol that disseminates membership and state without a coordinator.' },\r
      { id: 'swim', note: 'Detect failures at scale: SWIM has each node ping a random peer and, on silence, ask others to ping it before declaring it dead — spreading suspicion over gossip, so failure detection stays constant work per node.' },\r
      { id: 'hintedhandoff', note: 'Stay writable when a replica is down: a peer accepts the write on the absent node’s behalf and stores a hint, replaying it once the node returns — availability during a partition, at the cost of temporary divergence.' },\r
      { id: 'readrepair', note: 'Fix staleness on read: when a read gathers replicas that disagree, the newest value is returned and the lagging replicas are updated in the background — cheap convergence driven by ordinary traffic.' },\r
      { id: 'antientropy', note: 'Reconcile what reads miss: nodes periodically compare Merkle-tree hashes of their key ranges and exchange only the differing parts, healing replicas no recent read touched — the backstop for eventual consistency.' },\r
    ],\r
  },\r
  {\r
    id: 'symmcrypto',\r
    title: 'Inside symmetric crypto',\r
    icon: '🔐',\r
    blurb: 'One shared key, used to both scramble and authenticate. Follow the building blocks — a reversible block cipher, a modern stream cipher, two kinds of message authenticator, and the timing side channel that undoes them if you compare carelessly.',\r
    steps: [\r
      { id: 'feistel', note: 'Make a cipher reversible for free: a Feistel network (DES) splits each block in half and each round mixes one half through a function of the other, then swaps — decryption runs the identical steps in reverse, so the round function itself never needs to be invertible.' },\r
      { id: 'aesround', note: 'The modern block cipher: each AES round substitutes bytes through an S-box, shifts rows, mixes columns, and XORs in a round key — confusion and diffusion repeated 10–14 times until every output bit depends on every input and key bit.' },\r
      { id: 'chacha', note: 'Encrypt as a keystream: ChaCha20 builds a stream cipher from add-rotate-XOR quarter-rounds on a 4×4 state — no S-box, no data-dependent table lookups — and XORs the output over the plaintext, fast and constant-time in software.' },\r
      { id: 'poly1305', note: 'Authenticate in one shot: Poly1305 treats the message as the coefficients of a polynomial and evaluates it at a secret point modulo 2¹³⁰−5, producing a 16-byte tag — a one-time MAC that pairs with ChaCha20 for authenticated encryption.' },\r
      { id: 'hmac', note: 'A MAC from any hash: HMAC nests two keyed hashes — H((k⊕opad) ∥ H((k⊕ipad) ∥ m)) — authenticating a message and resisting the length-extension attack that a naive H(k ∥ m) falls to.' },\r
      { id: 'consttime', note: 'The timing side channel: comparing a tag or password byte by byte and returning on the first mismatch leaks how many bytes matched through timing — so crypto compares in constant time, touching every byte regardless of where they differ.' },\r
    ],\r
  },\r
  {\r
    id: 'failover',\r
    title: 'Agreeing and failing over',\r
    icon: '🗳️',\r
    blurb: 'When any node can crash, pause, or lie, a cluster still has to agree who leads, replicate consistently, and commit work. Walk from electing a leader to Byzantine consensus and transaction failover.',\r
    steps: [\r
      { id: 'bully', note: 'Pick a coordinator when the old one dies: the bully algorithm has any node that notices the leader is gone challenge everyone with a higher id, and the highest-id live node wins and announces itself — leader election after a crash.' },\r
      { id: 'leases', note: 'Hold leadership on a timer: a leader takes a lease valid for a bounded time and must renew it, so if it dies the lease simply expires and another can take over — but the scheme rests on clocks not drifting too far apart.' },\r
      { id: 'fencing', note: 'Stop a zombie leader: one that paused (a GC stall) can wake believing it still leads. A monotonically increasing fencing token on every write lets the storage reject anything stamped with an old number.' },\r
      { id: 'chainrep', note: 'Replicate in a line: chain replication passes each write head→tail through the replicas and serves reads only at the tail, giving strong consistency and a simple, well-defined failover when any link dies.' },\r
      { id: 'pbft', note: 'Agree despite traitors: Practical Byzantine Fault Tolerance reaches consensus even when up to a third of nodes lie or send conflicting messages, by voting in rounds and acting only on a two-thirds quorum — the basis of many permissioned blockchains.' },\r
      { id: 'saga', note: 'Fail forward across services: a saga replaces one distributed transaction with a chain of local ones, each paired with a compensating action, so a failure partway is cleaned up by running the compensations backward — no global lock.' },\r
    ],\r
  },\r
  {\r
    id: 'texteditor',\r
    title: 'Data structures inside a text editor',\r
    icon: '📝',\r
    blurb: 'Editing a big document means inserting and deleting anywhere, fast, thousands of times a second — a plain array can’t keep up. Follow the buffers that make it cheap, plus the trie behind autocomplete and the persistent map behind undo.',\r
    steps: [\r
      { id: 'gapbuffer', note: 'The classic buffer (Emacs): keep an empty gap in the array right at the cursor, so typing and deleting there are O(1) — just move the gap’s edges. Moving the cursor shuffles the gap to the new spot.' },\r
      { id: 'piecetable', note: 'The modern buffer (VS Code): never mutate the loaded file; append every insertion to a separate add-buffer and keep an ordered list of pieces pointing into the original or the add-buffer — cheap edits and near-free undo.' },\r
      { id: 'rope', note: 'For a huge document: a rope stores the text as a balanced tree of small chunks, so insert, delete, and index-by-position are O(log n) instead of O(n) on one giant contiguous array — the buffer that scales to gigabytes.' },\r
      { id: 'trie', note: 'Autocomplete as you type: a trie stores words along shared-prefix paths, so completing what you’ve typed is a walk of one node per character down to the subtree of everything that continues it.' },\r
      { id: 'hamt', note: 'Undo without copying: a hash array mapped trie is an immutable map where each edit shares almost all its structure with the previous version — so keeping every past state for undo (or collaborative editing) costs only the changed path.' },\r
    ],\r
  },\r
  {\r
    id: 'localnet',\r
    title: 'How a local network works',\r
    icon: '🔌',\r
    blurb: 'Before a packet ever reaches the internet it has to survive the local link — sharing the medium, getting an address, and finding its neighbors. Follow a device from joining the wire to discovering the printer down the hall.',\r
    steps: [\r
      { id: 'csma', note: 'Share the air with no scheduler: WiFi’s CSMA/CA has each device listen first and, if the channel is busy, wait a random backoff before transmitting — collisions are avoided by politeness, not a central slot assignment.' },\r
      { id: 'stptree', note: 'Keep frames from looping forever: with redundant links a broadcast would circulate endlessly, so the Spanning Tree Protocol elects a root switch and disables backup links to leave one loop-free path — re-enabled if a link fails.' },\r
      { id: 'vlan', note: 'Many networks on one switch: an 802.1Q VLAN tag in the frame header partitions a physical switch fabric into isolated virtual LANs, so ports in different VLANs can’t reach each other without going through a router.' },\r
      { id: 'dhcp', note: 'Get an address on joining: a new device broadcasts and a DHCP server answers in four steps — Discover, Offer, Request, Ack (DORA) — leasing it an IP, gateway, and DNS server so it can start talking.' },\r
      { id: 'icmp', note: 'How the network reports back: ICMP carries the control and error messages IP itself can’t — echo request/reply is ping, and time-exceeded is how traceroute maps every hop along a path.' },\r
      { id: 'mdns', note: 'Find services with no server: mDNS resolves .local names by multicasting the query to the whole link and DNS-SD advertises what each device offers — how your laptop finds a printer or a Chromecast with nothing configured.' },\r
    ],\r
  },\r
  {\r
    id: 'trafficshape',\r
    title: 'Shaping and limiting traffic',\r
    icon: '🚦',\r
    blurb: 'A shared link or service has a finite rate, so traffic has to be capped, smoothed, prioritized, and told to slow down. Follow the algorithms that limit senders and keep queues — and latency — under control.',\r
    steps: [\r
      { id: 'ratelimit', note: 'Cap the rate with room for bursts: a token bucket adds tokens at a fixed rate up to a cap and each request spends one, so steady traffic is limited but a short burst can drain the saved tokens at once — the classic API rate limiter.' },\r
      { id: 'leakybucket', note: 'Smooth a bursty stream: the leaky bucket queues arrivals and drains at a constant rate, so however spiky the input, the output is a steady trickle — shaping traffic to a fixed rate rather than only capping it.' },\r
      { id: 'gcra', note: 'Rate-limit with no queue: the generic cell rate algorithm tracks a single theoretical arrival time and admits a packet only if it isn’t too early — enforcing a rate and a burst allowance with one comparison and no stored queue.' },\r
      { id: 'qos', note: 'Decide who goes first: when a link is contended, QoS scheduling — priority queues, weighted fair queuing — serves classes of traffic in a chosen order, so a latency-sensitive packet isn’t stuck behind a bulk download.' },\r
      { id: 'ecn', note: 'Signal congestion without dropping: instead of discarding a packet when a queue fills, ECN sets a mark the receiver echoes back, telling the sender to slow down — congestion feedback a full round trip earlier than a loss would give.' },\r
      { id: 'bufferbloat', note: 'The latency trap: oversized buffers never drop, so they fill with a huge standing backlog that adds seconds of delay; active queue management (CoDel) watches how long packets sit and drops early to keep the queue — and latency — short.' },\r
    ],\r
  },\r
  {\r
    id: 'osinternals',\r
    title: 'Inside the operating system',\r
    icon: '🐧',\r
    blurb: 'The kernel gives every process the illusion of its own CPU, memory, and machine. Follow the mechanisms behind that illusion — entering the kernel, faulting in memory, forking cheaply, scaling I/O, and isolating a container.',\r
    steps: [\r
      { id: 'syscall', note: 'The only door into the kernel: a system call runs a trap instruction that switches the CPU to kernel mode and jumps to a fixed handler, so user code can ask for I/O or memory without touching hardware directly — the boundary every read, write, and mmap crosses.' },\r
      { id: 'pagefault', note: 'Memory on demand: a process’s pages aren’t all resident, so touching one that isn’t mapped traps into the kernel as a page fault, which allocates or loads it and resumes the instruction — how lazy allocation, mmap, and swap all work.' },\r
      { id: 'tlb', note: 'Cache the translations: every access needs a virtual→physical lookup, and walking the page table each time would be ruinous, so the TLB caches recent translations — a hit is a few cycles, a miss triggers the walk and refills it.' },\r
      { id: 'cow', note: 'Fork without copying: copy-on-write gives the child the parent’s whole address space as shared read-only pages, and only when one side writes does the kernel duplicate that single page — so fork then exec stays cheap.' },\r
      { id: 'epoll', note: 'One thread, ten thousand sockets: epoll registers interest in many file descriptors and returns only the ready ones in O(1), instead of rescanning every socket each call like poll/select — the kernel side of every high-concurrency server.' },\r
      { id: 'container', note: 'Isolation without a VM: namespaces give a process its own view of the filesystem, network, PIDs, and users while cgroups cap its CPU and memory — so it looks alone on the machine while sharing one kernel, no hypervisor needed.' },\r
    ],\r
  },\r
  {\r
    id: 'imaging',\r
    title: 'How color and images are encoded',\r
    icon: '🎨',\r
    blurb: 'A pixel is a number, but turning numbers into what your eye accepts as a smooth, correctly-lit photo takes real work. Follow how brightness and color are stored, how few colors fake many, and how photos and video are compressed.',\r
    steps: [\r
      { id: 'gamma', note: 'Why 128 isn’t half-bright: displays emit light nonlinearly and the eye perceives it nonlinearly, so pixels are stored gamma-encoded to pack precision into the darks — and blending or resizing without decoding to linear first darkens the result.' },\r
      { id: 'colorspace', note: 'Why RGB blends look muddy: sRGB isn’t perceptually uniform, so the numeric midpoint of two colors isn’t the one you’d call halfway. OKLab reshapes the space so equal steps look equally different and gradients pass through the right hues.' },\r
      { id: 'dithering', note: 'Fake gray with black and white: dithering scatters pixels so a few colors read as many — error diffusion pushes each pixel’s rounding error onto its neighbors, so a 1-bit image looks like smooth shading from a distance.' },\r
      { id: 'jpeg', note: 'Throw away what the eye won’t miss: JPEG splits an image into 8×8 blocks, transforms each to frequencies with the DCT, and quantizes the high frequencies hardest — because we notice fine detail far less than broad shapes.' },\r
      { id: 'hdr', note: 'Fit the sun on your screen: a real scene spans a dynamic range a display can’t emit, so tone-mapping compresses highlights and lifts shadows, keeping local contrast while squeezing the global range into the panel’s limits.' },\r
      { id: 'interframe', note: 'Send only what changed: video encodes most frames as differences from earlier ones — a motion vector says a block moved here, and only the small residual is stored, so a mostly-static scene costs almost nothing.' },\r
    ],\r
  },\r
  {\r
    id: 'insidehw',\r
    title: 'Inside the hardware',\r
    icon: '🔩',\r
    blurb: 'Under the software, bits are real charge in real cells that leak, wear out, and must be addressed and moved. Follow how a single bit is stored, how RAM and flash differ, and how the CPU reaches the right cell and talks to devices.',\r
    steps: [\r
      { id: 'latch', note: 'Store one bit: a flip-flop is a feedback loop of gates that holds a 0 or 1 until told to change — the storage cell inside every CPU register and every line of SRAM cache, fast because it’s pure logic.' },\r
      { id: 'dram', note: 'Store billions cheaply: DRAM packs one capacitor and one transistor per bit, but the charge leaks in milliseconds, so the controller must read and rewrite every row thousands of times a second — the refresh main memory never stops doing.' },\r
      { id: 'flashcell', note: 'Store without power: a flash cell traps electrons on a floating gate insulated so well the charge lasts years, and sensing that charge reads the bit — non-volatile, but writing tunnels electrons through the insulator, which slowly wears it out.' },\r
      { id: 'ssd', note: 'Build a disk from flash: flash erases a whole block before rewriting and each cell survives limited writes, so an SSD’s flash translation layer remaps addresses to spread wear and garbage-collect stale blocks — hiding those quirks behind a plain read/write interface.' },\r
      { id: 'membus', note: 'Find the right cell: an address decoder turns an N-bit address into exactly one active line among 2ᴺ, and the bus carries data to and from whichever chip and row that selects — how “read address X” physically lands on one location.' },\r
      { id: 'io', note: 'Talk to the outside world: a CPU can poll a device in a busy loop, let the device raise an interrupt when ready, or hand a bulk transfer to a DMA engine that moves data straight to memory — three strategies trading latency against wasted cycles.' },\r
    ],\r
  },\r
  {\r
    id: 'sysperf',\r
    title: 'Why fast code runs slow',\r
    icon: '🏎️',\r
    blurb: 'Correct code can still crawl for reasons the source never shows — cache layout, cores fighting over a line, memory on the wrong socket. Follow the performance gotchas every systems programmer eventually hits, and the fixes.',\r
    steps: [\r
      { id: 'cpucache', note: 'Memory isn’t flat: a CPU reads L1 in a few cycles but main memory in hundreds, and the cache’s sets-and-ways layout means one stride or alignment change can swing a program’s speed 100× — locality is the first performance lever.' },\r
      { id: 'falseshare', note: 'The invisible parallel slowdown: when two cores write different variables that share one 64-byte cache line, the line ping-pongs between their caches on every write, erasing the speedup threads promised — fixed by padding hot fields apart.' },\r
      { id: 'numa', note: 'Memory has a home: on a multi-socket server, RAM attached to another CPU is slower to reach, and the first core to touch a page decides where it lives — so whoever allocates and whoever uses memory must agree, or every access pays the remote tax.' },\r
      { id: 'priorityinv', note: 'The scheduling deadlock: a low-priority thread holding a lock can be preempted forever by mid-priority work while a high-priority thread waits on that lock — the bug that froze Mars Pathfinder, fixed by priority inheritance.' },\r
      { id: 'timingwheel', note: 'Millions of timers, O(1): scheduling and cancelling timeouts through a per-timer heap costs O(log n) each; a timing wheel — buckets on a rotating clock hand — inserts and expires in constant time, behind every network stack’s retransmit timers.' },\r
      { id: 'iouring', note: 'Thousands of I/Os, no syscall storm: io_uring gives the app and kernel two shared ring buffers, submission and completion, so a program queues many reads and writes and reaps results without a syscall per operation — the async I/O behind high-throughput servers.' },\r
    ],\r
  },\r
  {\r
    id: 'cryptoblocks',\r
    title: 'Cryptographic building blocks',\r
    icon: '🧩',\r
    blurb: 'Encryption is only the start. From a hash function and a bit of algebra you can split a secret, sign with nothing but hashing, authorize a message you can’t read, and prove you burned real work — the primitives behind e-cash, blockchains, and post-quantum signatures.',\r
    steps: [\r
      { id: 'shamir', note: 'Split a secret so no one holds it: Shamir hides the secret as the constant term of a random degree-(k−1) polynomial and hands each party one point — any k points interpolate it back, but k−1 reveal nothing about it.' },\r
      { id: 'feldman', note: 'Prove the shares are honest: a cheating dealer could hand out inconsistent shares, so Feldman’s verifiable secret sharing publishes commitments to the polynomial’s coefficients, letting each holder check its share is valid without learning the secret.' },\r
      { id: 'hashchain', note: 'A one-way sequence: hashing a seed repeatedly gives x, H(x), H(H(x))… that you reveal in reverse, each value proving the next without exposing the seed — behind S/Key one-time passwords, secure timestamps, and the links of a blockchain.' },\r
      { id: 'lamportsig', note: 'Sign with only a hash: a Lamport signature reveals the preimages selected by the message’s bits from a one-time keypair of random values — a signature needing nothing but a hash function, and the foundation of hash-based post-quantum signatures.' },\r
      { id: 'blindsig', note: 'Sign what you can’t see: a blind signature lets a signer authorize a message they never read — the requester blinds it, gets it signed, then unblinds a valid signature on the original. The basis of digital cash and anonymous credentials.' },\r
      { id: 'pow', note: 'Burn computation as proof: proof of work makes a prover search for a nonce whose hash has enough leading zeros — expensive to find, instant to check — turning spam and Sybil attacks costly (Hashcash) and anchoring Nakamoto consensus (Bitcoin).' },\r
    ],\r
  },\r
  {\r
    id: 'dbindex',\r
    title: 'Structures that make queries fast',\r
    icon: '📇',\r
    blurb: 'A database or search engine can’t rescan everything for each query, so it keeps auxiliary structures that answer filters, range aggregates, and overlaps in log time or less. Follow the bitmap and tree indexes behind fast lookups.',\r
    steps: [\r
      { id: 'bitmapindex', note: 'Filter without scanning: a bitmap index keeps one bit-vector per column value, so color=red AND size=L is a bitwise AND of two vectors — the set bits are the matching rows, found in one pass over compact bitmaps instead of the whole table.' },\r
      { id: 'roaring', note: 'Keep the bitmaps small: a sparse or dense column wastes space as a plain bitmap, so roaring bitmaps split the key range into 65k-key chunks and store each as a sorted array, a bitmap, or run-lengths — whichever is smallest — staying compact and fast to AND at any density.' },\r
      { id: 'fenwick', note: 'Running totals with live updates: a Fenwick (binary indexed) tree answers “sum of the first k” and “add to position i” both in O(log n) by storing partial sums at cleverly-chosen indices — the compact structure behind rank queries and cumulative frequencies.' },\r
      { id: 'segtree', note: 'Any range aggregate: a segment tree generalizes to range min, max, sum, or gcd with range updates via lazy propagation — O(log n) per query, the workhorse for “what’s the min between i and j, and add 5 to that whole range”.' },\r
      { id: 'sparsetable', note: 'Instant range-min, if nothing changes: for immutable data a sparse table precomputes every power-of-two-length window in O(n log n), then answers any range-minimum in O(1) by overlapping two windows — no per-query work at all.' },\r
      { id: 'intervaltree', note: 'Which intervals overlap: an interval tree stores ranges so “which stored intervals contain this point or overlap this range” takes O(log n + k) — behind calendars, genome browsers, and which firewall rule matches a packet.' },\r
    ],\r
  },\r
  {\r
    id: 'neuralnet',\r
    title: 'How modern AI works',\r
    icon: '🧠',\r
    blurb: 'From a 1950s threshold unit to the transformer behind today’s language models. Follow how a network learns, how words become geometry, how attention replaced recurrence, and how millions of embeddings are searched.',\r
    steps: [\r
      { id: 'perceptron', note: 'The first neural net: a perceptron sums weighted inputs and fires if the total clears a threshold — it learns any linearly-separable rule, but famously can’t learn XOR, the limit that stalled the field until hidden layers broke it.' },\r
      { id: 'backprop', note: 'How a deep net learns: backpropagation runs the chain rule backward through the layers to get the gradient of the loss for every weight at once, so gradient descent can nudge millions of them toward lower error.' },\r
      { id: 'word2vec', note: 'Words as geometry: word2vec learns a vector per word from nothing but which words co-occur, and meaning becomes direction — similar words cluster, and king − man + woman lands near queen.' },\r
      { id: 'attention', note: 'The transformer’s core: attention lets each token look at every other and weight them by relevance, mixing in the ones that matter — replacing recurrence with a parallel operation, the mechanism under every large language model.' },\r
      { id: 'vectorsearch', note: 'Retrieval at scale: once text is embeddings, finding the nearest among millions can’t be a linear scan; HNSW builds a navigable small-world graph so nearest-neighbor search is roughly logarithmic — the retrieval behind semantic search and RAG.' },\r
    ],\r
  },\r
  {\r
    id: 'shrinkdata',\r
    title: 'How data gets smaller',\r
    icon: '🗜️',\r
    blurb: 'Beyond the LZ77/Huffman basics, shrinking data takes a toolbox: dictionary coders, fractional-bit entropy coding, transforms that expose structure, and the dedup and delta tricks that avoid storing or sending anything twice.',\r
    steps: [\r
      { id: 'lzw', note: 'Spot repetition as you go: LZW builds a dictionary of substrings while reading, emitting one code per phrase it has seen before — no separate table to ship, the scheme behind GIF and early Unix compress.' },\r
      { id: 'mtf', note: 'Exploit recency: move-to-front recodes each symbol as its position in a list that promotes it to the front, so locally-repetitive data turns into a stream of small numbers — the step after Burrows-Wheeler in bzip2.' },\r
      { id: 'arith', note: 'Beat the whole-bit limit: arithmetic coding represents the entire message as one number in [0,1), so a symbol can cost a fractional bit — squeezing closer to the entropy floor than Huffman, which must spend at least one bit per symbol.' },\r
      { id: 'cdc', note: 'Split so edits stay local: content-defined chunking cuts a file at boundaries chosen by the data via a rolling hash, so inserting a byte re-chunks only nearby — the basis of deduplication in backup and sync systems.' },\r
      { id: 'rsync', note: 'Send only the difference: rsync rolls a weak-then-strong hash over both copies to find the blocks the receiver already has, transferring just the changed ones — updating a huge file over a slow link in seconds.' },\r
      { id: 'gorilla', note: 'Compress a firehose of floats: Gorilla XORs each metric value against the previous one — near-identical values become mostly zeros — and delta-encodes timestamps, shrinking time-series data roughly 10× in memory.' },\r
    ],\r
  },\r
  {\r
    id: 'resilience',\r
    title: 'How a service survives failure and load',\r
    icon: '🛟',\r
    blurb: 'Every dependency will eventually be slow, down, or overwhelmed. Follow the patterns that keep a service standing when they are — retrying safely, shedding overload, isolating faults, and deploying without dropping a request.',\r
    steps: [\r
      { id: 'retry', note: 'Retry the transient, stop hammering the dead: retry a failed call with exponential backoff and jitter so a blip recovers, but wrap it in a circuit breaker that trips open after repeated failures — sparing a struggling dependency until it heals.' },\r
      { id: 'loadshed', note: 'Reject early when overloaded: past capacity, quickly refusing the excess (a fast 503) keeps the requests you do accept inside their deadline — a service that sheds load degrades gracefully instead of collapsing under it.' },\r
      { id: 'bulkhead', note: 'Isolate so one failure can’t sink the ship: give each dependency its own bounded pool of threads or connections, so a slow downstream call exhausts only its own bulkhead and the rest of the service keeps serving.' },\r
      { id: 'singleflight', note: 'Do duplicate work once: when a cached value expires, a thousand requests can stampede the backend at once; request coalescing runs the fetch a single time and hands the one result to every waiter.' },\r
      { id: 'gracefulshutdown', note: 'Deploy without dropping requests: on SIGTERM, stop accepting new connections, finish the in-flight ones, close pools, then exit — so a rolling deploy or scale-down loses zero requests instead of cutting them mid-flight.' },\r
      { id: 'featureflags', note: 'Separate deploy from release: a feature flag ships code dark and turns it on for 1% → 100% at runtime, with an instant kill switch — so a bad change is disabled in seconds without a rollback deploy.' },\r
    ],\r
  },\r
  {\r
    id: 'signal',\r
    title: 'End-to-end encrypted messaging (Signal)',\r
    icon: '💬',\r
    blurb: 'How Signal and WhatsApp keep a chat readable only to its two ends — starting from a shared secret, defeating the middleman, opening a conversation while one side is offline, and giving every single message its own key.',\r
    steps: [\r
      { id: 'dhkex', note: 'Agree on a secret in the open: Diffie–Hellman lets two parties who’ve never met derive a shared key over a public channel — each mixes their own secret with the other’s public value and only they compute the same result. The foundation every key exchange builds on.' },\r
      { id: 'dhmitm', note: 'Why raw DH isn’t enough: plain Diffie–Hellman authenticates nobody, so an attacker in the middle can run a separate exchange with each side and read everything — the reason a key exchange must be tied to verified identities.' },\r
      { id: 'x3dh', note: 'Start a conversation even if you’re offline: Signal’s X3DH combines several Diffie–Hellman results — including against prekeys the recipient published in advance — so the first message is authenticated and encrypted without both devices ever being online at once.' },\r
      { id: 'ratchet', note: 'A fresh key for every message: the Double Ratchet advances a DH ratchet each reply and a symmetric ratchet each message, so keys only move forward — a stolen key can’t decrypt past messages (forward secrecy) and the conversation heals after a compromise.' },\r
    ],\r
  },\r
  {\r
    id: 'stringsearch',\r
    title: 'Searching inside text',\r
    icon: '🔎',\r
    blurb: 'Finding a pattern in a string is deeper than a nested loop. Follow the algorithms that search without backtracking, skip whole chunks, compute matches in linear time, and even find words a typo away.',\r
    steps: [\r
      { id: 'kmp', note: 'Exact search without backtracking: KMP precomputes a failure table from the pattern, so on a mismatch it slides forward by the longest prefix that’s still a suffix — never re-reading a text character, O(n + m).' },\r
      { id: 'boyermoore', note: 'Skip whole chunks: Boyer-Moore compares the pattern right-to-left and, on a mismatch, jumps ahead by the bad-character and good-suffix rules — often examining far fewer than n characters, which is why it’s the core of grep.' },\r
      { id: 'zalgo', note: 'One array, many string problems: the Z-algorithm computes, for every position, how long a substring starting there matches the string’s own prefix — in linear time — a primitive that solves pattern matching, periodicity, and more.' },\r
      { id: 'manacher', note: 'Longest palindrome in linear time: Manacher’s algorithm finds the longest palindromic substring in O(n) by reusing the mirror of palindromes already found, instead of expanding around every center from scratch.' },\r
      { id: 'bktree', note: 'Find the typo: a BK-tree indexes words by edit distance using the triangle inequality, so a spell-checker retrieves every word within k edits of a query without comparing against the whole dictionary.' },\r
    ],\r
  },\r
  {\r
    id: 'numcoding',\r
    title: 'Encoding numbers compactly',\r
    icon: '🔢',\r
    blurb: 'A 32-bit int wastes most of its bytes on small values, and a raw number can’t be read aloud or survive a noisy dial. Follow the codes that pack integers tight, self-delimit any magnitude, and stay safe to transcribe.',\r
    steps: [\r
      { id: 'varint', note: 'Small numbers, few bytes: a varint stores 7 data bits per byte with the top bit meaning “more follows”, so 5 takes one byte and 300 takes two — Protobuf’s integer format. Zigzag first folds signed numbers (−1→1, 1→2) so a small negative doesn’t cost ten bytes.' },\r
      { id: 'eliascode', note: 'Encode any positive integer with no agreed width: Elias gamma writes the number’s bit-length in unary, then its bits — a self-delimiting universal code, so a stream of wildly different magnitudes needs no fixed field size.' },\r
      { id: 'golombrice', note: 'Optimal when small values dominate: Golomb-Rice splits each value into a quotient coded in unary and a remainder in binary, near-optimal for geometric distributions — the coder inside FLAC, many image formats, and compressed search indexes.' },\r
      { id: 'graycode', note: 'Change one bit at a time: Gray code orders the integers so consecutive values differ in exactly one bit, so a rotary or position encoder caught mid-transition reads an adjacent value, never a wildly wrong one.' },\r
      { id: 'base58', note: 'Numbers humans can copy: Base58 drops the look-alike 0, O, I, and l from base64 and appends a checksum (Base58Check), so a Bitcoin address or key survives being read aloud, written down, or mistyped.' },\r
    ],\r
  },\r
  {\r
    id: 'latencymetrics',\r
    title: 'Measuring latency at scale',\r
    icon: '📊',\r
    blurb: 'The average response time hides everything that matters. Follow why the tail dominates, how to measure and merge percentiles honestly, why adding servers eventually backfires, and how to store the firehose of samples.',\r
    steps: [\r
      { id: 'taillatency', note: 'Why the average lies: one page touches dozens of services, so the slowest of many calls sets the total — the p99 tail, not the mean, is what users feel. Shaving the median barely helps; taming the tail is the real work.' },\r
      { id: 'hdrhist', note: 'Measure percentiles honestly: you can’t recover a p99 from an average, so HdrHistogram records every value into log-spaced buckets spanning microseconds to seconds at fixed relative precision — cheap to update and accurate out in the tail.' },\r
      { id: 'ddsketch', note: 'Percentiles you can merge: DDSketch buckets values with a guaranteed relative error and — crucially — its sketches add together, so a fleet-wide p99 comes from summing each server’s sketch instead of shipping raw samples.' },\r
      { id: 'usl', note: 'Why more servers stop helping: the Universal Scalability Law models throughput as linear speedup minus a contention term (serialized work) and a coherency term (crosstalk between nodes) — predicting the peak beyond which adding capacity makes the system slower.' },\r
      { id: 'gorilla', note: 'Store the firehose of samples: Gorilla compresses time-series by XORing each float against the last and delta-encoding timestamps, shrinking metrics ~10× so a monitoring system holds millions of latency points in memory to compute those percentiles fast.' },\r
    ],\r
  },\r
  {\r
    id: 'hashfns',\r
    title: 'How hash functions work and break',\r
    icon: '#️⃣',\r
    blurb: 'A cryptographic hash is a one-way fingerprint everything from certificates to passwords depends on. Follow what one actually computes, the structural flaw that bites naïve use, how a hash dies, and why passwords need a different kind.',\r
    steps: [\r
      { id: 'hashint', note: 'What a hash actually does: SHA-256 chops the message into blocks and runs each through a 64-round compression function — mixing, rotating, adding — so every input bit avalanches across all 256 output bits, and the digest is fixed-size, one-way, and collision-resistant.' },\r
      { id: 'lenext', note: 'The length-extension flaw: because a Merkle-Damgård hash’s output IS its internal state, an attacker who knows H(secret ‖ message) can resume hashing and compute H(secret ‖ message ‖ extra) without the secret — forging a valid tag for data they append.' },\r
      { id: 'hmac', note: 'Keyed hashing done right: HMAC wraps the hash in two keyed passes — H((k⊕opad) ‖ H((k⊕ipad) ‖ m)) — so the output no longer exposes a resumable state, closing the length-extension hole a naïve H(k ‖ m) leaves open.' },\r
      { id: 'hashbreak', note: 'When a hash breaks: a collision is two different inputs with the same digest, and once one is cheap the hash is dead — MD5 collisions are trivial today and SHA-1’s were demonstrated, enough to forge certificates and sign malicious files as trusted.' },\r
      { id: 'pwhash', note: 'Why a fast hash is wrong for passwords: SHA-256 is too fast — a GPU tries billions a second. Password hashes (bcrypt, scrypt, Argon2) are deliberately slow and memory-hard, with a per-user salt, so cracking a leaked database stays infeasible.' },\r
    ],\r
  },\r
  {\r
    id: 'overlays',\r
    title: 'Network tunnels and overlays',\r
    icon: '🚇',\r
    blurb: 'A packet often rides inside another packet — to stretch a LAN across the globe, switch faster than an IP lookup, pin a route from the source, or cross the public internet privately. Follow the encapsulations that make one network run on top of another.',\r
    steps: [\r
      { id: 'vxlan', note: 'A virtual LAN over the internet: VXLAN wraps each Ethernet frame in a UDP packet with a 24-bit segment ID, so two machines in different data centers behave as if on the same L2 switch — the overlay under cloud and container networking.' },\r
      { id: 'mpls', note: 'Switch on a label, not an IP: MPLS pushes a short fixed label onto each packet at the network edge, and core routers forward by a fast label lookup along a pre-built path — separating forwarding from the full IP routing table.' },\r
      { id: 'segrouting', note: 'Put the route in the packet: segment routing encodes the path as an ordered list of segments in the header, so the source picks the route and the core keeps no per-flow state — MPLS’s successor for traffic engineering.' },\r
      { id: 'ipsec', note: 'Encrypt the whole packet in a tunnel: IPsec ESP wraps and encrypts an entire IP packet between two gateways, so a site-to-site VPN carries private traffic across the public internet — authenticated and confidential.' },\r
    ],\r
  },\r
  {\r
    id: 'causalorder',\r
    title: 'Ordering events in a distributed system',\r
    icon: '⏳',\r
    blurb: 'With no shared clock and messages that overtake each other, “what happened before what?” is genuinely hard. Follow how systems recover a causal order, snapshot themselves mid-run, promise clients a consistency level, and reconcile concurrent edits.',\r
    steps: [\r
      { id: 'lamport', note: 'Logical time: a Lamport clock is a counter bumped on each event and carried on each message, giving an ordering consistent with cause-and-effect — a total order without any synchronized wall clock.' },\r
      { id: 'causalbcast', note: 'Deliver in causal order: causal broadcast holds each message until every message that causally precedes it has been delivered, so no node ever sees an effect before its cause — buffering out-of-order arrivals until their dependencies are met.' },\r
      { id: 'chandy', note: 'A snapshot without stopping: the Chandy-Lamport algorithm records a consistent global state — each node’s state plus the messages in flight — by sending markers along channels, so you can checkpoint or detect deadlock without pausing the system.' },\r
      { id: 'consistency', note: 'What order clients are promised: consistency models form a spectrum — linearizable, sequential, causal, eventual — each a weaker guarantee about the order in which replicas appear to apply operations, trading correctness for availability and speed.' },\r
      { id: 'watermark', note: 'Ordering an endless stream: a watermark is the system’s assertion that “no event older than time T will still arrive,” letting a windowed computation finalize its result despite late, out-of-order data.' },\r
      { id: 'optransform', note: 'Converging concurrent edits: operational transformation rewrites each edit against the ones made concurrently, so two people typing in the same document at once converge to an identical result — the classic collaborative-editor algorithm.' },\r
    ],\r
  },\r
  {\r
    id: 'advrouting',\r
    title: 'Advanced routing: scale and redundancy',\r
    icon: '🛰️',\r
    blurb: 'Picking a route is only the start; a real network must scale that decision to every router, damp instability, use all its links, and survive a dead gateway. Follow the mechanisms that keep large networks fast and up.',\r
    steps: [\r
      { id: 'bgp', note: 'The internet’s routing protocol: BGP is a path-vector protocol where each network advertises which destinations it can reach and by what AS path, and a long tie-break list (local preference, AS-path length, …) picks the best route among all offers.' },\r
      { id: 'bgprr', note: 'Scale iBGP without a full mesh: every router in an AS must learn every external route, but a full mesh is n(n−1)/2 sessions; a route reflector re-advertises routes to its clients, collapsing that mesh into hub-and-spoke.' },\r
      { id: 'routeflap', note: 'Damp a flapping route: a link bouncing up and down would ripple withdrawals across the whole internet, so flap damping adds a penalty on each change that decays exponentially and suppresses the route until it settles.' },\r
      { id: 'ecmp', note: 'Use every equal path: when several paths tie for best, ECMP hashes each flow’s 5-tuple to pick one consistently — so a connection stays on a single path (no reordering) while the aggregate traffic spreads across all of them.' },\r
      { id: 'vrrp', note: 'Survive a dead gateway: VRRP lets two routers share one virtual IP and MAC, so if the active default gateway fails the backup answers within a second — and no client ever changes its configured gateway.' },\r
    ],\r
  },\r
  {\r
    id: 'cryptomath',\r
    title: 'The arithmetic behind public-key crypto',\r
    icon: '🔓',\r
    blurb: 'RSA and Diffie–Hellman are modular arithmetic on enormous numbers. Follow the two primitives that make them run — modular inverse and fast modular multiply — and the two classic attacks whose cost dictates how big the keys must be.',\r
    steps: [\r
      { id: 'xgcd', note: 'Division in modular arithmetic: there’s no “divide” mod m, so you multiply by the modular inverse — and the extended Euclidean algorithm finds a⁻¹ (the x with ax ≡ 1) in a few steps. RSA key generation, ECDSA, and CRT all rest on it.' },\r
      { id: 'montgomery', note: 'Multiply mod m without dividing: a naive modular multiply needs a costly division to reduce, so Montgomery form replaces it with shifts and adds — making the millions of modular multiplications in an RSA or DH exponentiation fast.' },\r
      { id: 'pollardrho', note: 'Factor by accident: Pollard’s rho hunts a factor of n with a cycle-detecting random walk that collides modulo a hidden prime factor in about n^(1/4) steps — cheap enough that RSA moduli must be thousands of bits.' },\r
      { id: 'bsgs', note: 'Meet in the middle on a discrete log: baby-step giant-step solves gˣ ≡ h by precomputing √n “baby” values and striding in √n “giant” steps until they meet — O(√n), which is why Diffie–Hellman groups must be enormous.' },\r
    ],\r
  },\r
  {\r
    id: 'httpstls',\r
    title: 'How HTTPS really secures you',\r
    icon: '🔐',\r
    blurb: 'A padlock is the least of it. Follow the machinery that makes a connection trustworthy — the handshake and the public-key math under it, how a stolen certificate gets caught, and the downgrade and stripping attacks it must survive, down to verifying the very scripts a page pulls in.',\r
    steps: [\r
      { id: 'tlsflow', note: 'The TLS handshake as one flow: agree on a cipher, prove the server’s identity with a certificate chain, derive a shared key over the public wire, then encrypt and authenticate everything after.' },\r
      { id: 'pubkey', note: 'What makes the handshake possible: a keypair where the public key encrypts or verifies and only the private key decrypts or signs — so two strangers agree on a secret nobody listening can read.' },\r
      { id: 'revocation', note: 'Trust must be revocable: when a certificate is stolen or mis-issued, OCSP and CRLs mark it dead, and Certificate Transparency logs make every issued cert publicly auditable so a rogue one is caught.' },\r
      { id: 'tlsdowngrade', note: 'The attack: a meddler-in-the-middle nudges the negotiation down to an obsolete, breakable cipher or protocol version — which only fails if both sides refuse to go that low.' },\r
      { id: 'hsts', note: 'The defense: HSTS tells the browser “only ever reach me over HTTPS,” so after the first visit an attacker can’t strip later requests down to plaintext http — the first plaintext visit is still exposed (trust-on-first-use) unless the domain is preloaded.' },\r
      { id: 'sri', note: 'The last gap: a page loads scripts from CDNs it doesn’t control — Subresource Integrity pins each file’s hash, so a tampered or swapped resource is rejected instead of run.' },\r
    ],\r
  },\r
  {\r
    id: 'iplayer',\r
    title: 'The IP layer, modernized',\r
    icon: '🌐',\r
    blurb: 'IPv4 ran out of addresses years ago, yet the internet kept growing. Follow how a host gets on today’s network and moves a packet — the v6 addressing that replaced it, configuring itself with no server, sizing packets to the path, one-to-many delivery, racing dual-stack, and punching through NAT.',\r
    steps: [\r
      { id: 'ipcompare', note: 'IPv4’s 32-bit space ran dry; IPv6 gives every device a 128-bit address and a fixed 40-byte header — the addressing everything below rests on.' },\r
      { id: 'slaac', note: 'No DHCP server needed: an IPv6 host builds its own address from the router-advertised prefix plus an interface id, then checks nobody else already has it (duplicate-address detection).' },\r
      { id: 'fragment', note: 'A packet larger than a link’s MTU is split into fragments the destination reassembles — and why IPv6 moves that job to the sender via Path MTU discovery.' },\r
      { id: 'multicast', note: 'One sender, many receivers: IGMP lets hosts join a group so a single stream reaches all of them, instead of the network duplicating a unicast per receiver.' },\r
      { id: 'happyeyeballs', note: 'With both IPv4 and IPv6 available, the client races connections to both and keeps whichever answers first — so a broken v6 path never stalls the page.' },\r
      { id: 'natpunch', note: 'Two hosts both behind NAT still connect directly: they punch holes by sending outward at the same time, so each NAT accepts the other’s return traffic — the trick behind peer-to-peer and video calls.' },\r
    ],\r
  },\r
  {\r
    id: 'attacktour',\r
    title: 'How systems get attacked, layer by layer',\r
    icon: '💀',\r
    blurb: 'Attacks come from every layer. A tour of distinct techniques — intercepting a LAN, prising out a key one byte at a time, weaponizing an algorithm’s worst case, flipping bits inside a chip — then the kill-chain view that strings them into a real intrusion. Sandboxed and defensive throughout.',\r
    steps: [\r
      { id: 'arpspoof', note: 'Intercept a LAN: forge ARP replies so the victim and the gateway both send their traffic through you — the classic man-in-the-middle on a switched network, and why we authenticate above L2.' },\r
      { id: 'paddingoracle', note: 'Extract a secret without the key: a server that merely leaks whether a ciphertext’s padding is valid lets an attacker decrypt it one byte at a time — why modern modes authenticate first.' },\r
      { id: 'hashflood', note: 'Weaponize a data structure: feed a hash table keys that all collide and its O(1) lookups become O(n²), stalling the server — algorithmic-complexity denial of service, fixed by seeded hashing.' },\r
      { id: 'redos', note: 'Weaponize a regex: a pattern with catastrophic backtracking takes exponential time on a crafted input, hanging the thread that runs it — the reason engines cap or linearize matching.' },\r
      { id: 'rowhammer', note: 'Attack the silicon: electrically hammering one DRAM row flips bits in an adjacent row you can’t even address, breaking memory isolation from pure software — mitigated by ECC and target-row refresh.' },\r
      { id: 'killchain', note: 'Zoom out: real intrusions chain these — recon, initial access, escalation, lateral movement — and defense-in-depth means breaking any single link stops the whole chain.' },\r
    ],\r
  },\r
  {\r
    id: 'elegantalgos',\r
    title: 'Elegant algorithmic tricks',\r
    icon: '✨',\r
    blurb: 'Some algorithms are startlingly simple once you see the trick. Four that crack a seemingly-hard problem in one pass or O(1) extra space — a max-sum scan, a majority vote, a cycle finder, and an all-pairs shortest path.',\r
    steps: [\r
      { id: 'kadane', note: 'Max-sum subarray in one pass: track the best sum ending here, and drop it whenever it turns negative — O(n) for a problem that looks like it needs O(n²).' },\r
      { id: 'majority', note: 'Find the element appearing more than n/2 times in O(1) space: Boyer–Moore keeps one candidate and a counter, cancelling opposing pairs — whatever survives is the majority.' },\r
      { id: 'cycledetect', note: 'Detect a loop with two pointers and no extra memory: a slow and a fast walker must eventually meet inside any cycle — Floyd’s tortoise and hare.' },\r
      { id: 'floyd', note: 'All-pairs shortest paths in one triple loop: Floyd–Warshall relaxes every route through each intermediate vertex in turn — cubic time, a few lines, handles negative edges.' },\r
    ],\r
  },\r
  {\r
    id: 'realtimeweb',\r
    title: 'Beyond request-response (real-time & streaming)',\r
    icon: '📡',\r
    blurb: 'The web began as one-shot request-response, but modern apps need servers that push and connections that stream. Four steps past plain HTTP — a full-duplex socket, the server-push patterns, typed streaming RPC, and a transport built for many streams at once.',\r
    steps: [\r
      { id: 'websocket', note: 'HTTP is one-shot; a WebSocket starts as an HTTP request then upgrades the same TCP connection to a full-duplex channel where either side sends any time.' },\r
      { id: 'realtime', note: 'Server push, along a spectrum: long-poll, Server-Sent Events, and WebSockets deliver the same events at different latencies — SSE is simple and one-way, WebSocket is bidirectional; choose by whether the client also needs to talk back.' },\r
      { id: 'grpc', note: 'Typed, streaming RPC: gRPC serializes calls with protobuf over HTTP/2 and supports client-, server-, and bidirectional streams — the backbone of internal microservice traffic.' },\r
      { id: 'sctp', note: 'A transport that survives a dead path: SCTP binds multiple network links into one association and fails over to an alternate when one times out — multi-homing a connection instead of dropping it the way single-path TCP would.' },\r
    ],\r
  },\r
  {\r
    id: 'scene2pixels',\r
    title: 'From a 3D scene to pixels',\r
    icon: '🎨',\r
    blurb: 'How a rendered image comes to be. Orient objects in 3D without gimbal lock, draw them on a GPU’s thousands of parallel threads, smooth the jagged edges, then compress the finished image by scale.',\r
    steps: [\r
      { id: 'quaternion', note: 'Rotate in 3D without gimbal lock: a quaternion composes rotations cleanly and slerp interpolates between orientations smoothly — how engines orient every camera and object.' },\r
      { id: 'gpu', note: 'Render in parallel: a GPU runs thousands of threads in lockstep (SIMT), each shading a pixel or vertex — the hardware behind real-time graphics (and, later, ML).' },\r
      { id: 'msaa', note: 'Kill the jaggies: sampling a shape once per pixel stairsteps its edges; MSAA takes several sub-pixel coverage samples and averages them, softening the aliasing.' },\r
      { id: 'haarwavelet', note: 'Compress by scale: the Haar wavelet splits the image into a coarse average plus fine details — and since the details are mostly near-zero, keeping the largest few rebuilds it from a fraction of the data.' },\r
    ],\r
  },\r
  {\r
    id: 'exoticcrypto',\r
    title: 'Cryptography’s exotic corners',\r
    icon: '🧪',\r
    blurb: 'Beyond textbook RSA lies a stranger world: encryption that’s randomized, that lets you add numbers while they stay secret, that wraps keys inside keys, and that rests on quantum physics rather than hard math.',\r
    steps: [\r
      { id: 'elgamal', note: 'A public-key scheme built on the discrete log: ElGamal is randomized, so the same message encrypts to a different ciphertext every time — the ancestor of much modern crypto.' },\r
      { id: 'paillier', note: 'Add numbers while they stay encrypted: Paillier is additively homomorphic — multiply two ciphertexts and you get the encryption of their sum, so a server can total values it can’t read — the engine behind private voting and aggregation.' },\r
      { id: 'envelope', note: 'Encrypt the key, not just the data: a data key encrypts the payload and a master key in an HSM/KMS encrypts that data key, so rotating or revoking access is cheap and centralized.' },\r
      { id: 'bb84', note: 'Agree on a key with physics: BB84 sends qubits in random bases, and any measurement disturbs them — so an eavesdropper injects detectable errors. Security from quantum mechanics, not a hard problem.' },\r
    ],\r
  },\r
  {\r
    id: 'machineinmotion',\r
    title: 'The running machine, up close',\r
    icon: '⚙️',\r
    blurb: 'What actually happens when a computer runs your code. Follow one instruction through the CPU, see why real chips run things out of order, trace a single keystroke from key to pixel, then freeze the whole thing in a debugger to look inside.',\r
    steps: [\r
      { id: 'cpucycle', note: 'One instruction, step by step: fetch it from memory, decode what it means, execute in the ALU, write the result back — the cycle a CPU repeats billions of times a second.' },\r
      { id: 'oooexec', note: 'Real CPUs don’t wait in order: they execute each instruction as soon as its inputs are ready and retire them in program order, hiding memory stalls behind useful work.' },\r
      { id: 'keystroke', note: 'From key to pixel: a keypress becomes a scan code, an interrupt, a driver event, an app update, and a repaint — the whole stack behind one letter appearing on screen.' },\r
      { id: 'breakpoint', note: 'Freeze it to look: a debugger overwrites one instruction byte with a trap (INT3); when the CPU reaches it, the OS stops the process and hands control to the debugger to inspect registers and memory.' },\r
    ],\r
  },\r
  {\r
    id: 'serviceatscale',\r
    title: 'Operating a service at scale',\r
    icon: '📈',\r
    blurb: 'One box becomes a fleet, and new failure modes appear. Spread the load, understand why latency explodes near capacity, control the fleet with feedback, and mint unique ids across it all with no coordinator.',\r
    steps: [\r
      { id: 'lb', note: 'Spread requests across a pool of backends — round-robin, least-connections, or hash-based — so no single server melts while others sit idle.' },\r
      { id: 'queueing', note: 'Why latency explodes near capacity: an M/M/1 queue shows wait time shooting toward infinity as utilization nears 100% — the reason you never run a server flat out.' },\r
      { id: 'pid', note: 'Feedback control for autoscaling: a PID controller sets capacity from the error between target and actual load, damping oscillation the way cruise control or a thermostat does.' },\r
      { id: 'snowflake', note: 'Unique ids with no coordinator: a Snowflake id packs a timestamp, a machine id, and a counter into 64 bits, so thousands of servers mint sortable ids without ever talking to each other.' },\r
    ],\r
  },\r
  {\r
    id: 'robustcodes',\r
    title: 'Encoding data for the real world',\r
    icon: '🔡',\r
    blurb: 'Data has to survive smudges, misreads, and dropped bits — and sometimes encode where a thing is. Add redundancy to detect corruption, then correct it, then turn a location into a searchable string.',\r
    steps: [\r
      { id: 'errors', note: 'The fundamentals: add redundancy so corruption is detectable (parity, checksums) or even correctable — the basis of every reliable channel and storage medium.' },\r
      { id: 'barcode', note: 'A tiny error check: a UPC barcode’s last digit is a weighted checksum of the rest, so a single misread is caught at the register instead of charging for the wrong item.' },\r
      { id: 'qrcode', note: 'Correction, not just detection: a QR code carries Reed–Solomon parity, so a torn or smudged code — up to roughly 30% damaged — still decodes cleanly.' },\r
      { id: 'geohash', note: 'Encode a location as a string: interleaving latitude and longitude bits makes nearby places share a common prefix, so proximity search becomes a prefix match.' },\r
    ],\r
  },\r
  {\r
    id: 'wheredatalives',\r
    title: 'Where your data lives',\r
    icon: '🗄️',\r
    blurb: 'Storage is a set of tradeoffs. See how a filesystem scatters a file into blocks, how Git stores content by its hash, how the OS decides which pages to evict from RAM, and the three-way tradeoff every storage engine must pick from.',\r
    steps: [\r
      { id: 'inode', note: 'A file isn’t one contiguous thing: an inode holds its metadata and a list of block pointers — direct, then single, double, and triple indirect — so one scheme spans a tiny file and a huge one.' },\r
      { id: 'gitobjects', note: 'Git stores content, not files: every blob, tree, and commit is named by the SHA of its contents and stored once, so identical data is deduplicated automatically.' },\r
      { id: 'pagereplace', note: 'RAM is smaller than the working set, so the OS evicts pages — LRU, the clock algorithm, and their approximations decide what to drop when a new page is faulted in.' },\r
      { id: 'rum', note: 'Every storage engine picks two of three: fast Reads, cheap Updates, small Memory — a B-tree keeps reads cheap, a leveled-LSM keeps space tight, a tiered-LSM keeps writes cheap, and none escapes the third.' },\r
    ],\r
  },\r
  {\r
    id: 'joinnetwork',\r
    title: 'How a device joins a network',\r
    icon: '🔌',\r
    blurb: 'Before a device sends a single real packet it has to get onto the network: prove it’s allowed on, encrypt the air link, lease an address, and find the gateway. The four steps that happen before your first byte of data.',\r
    steps: [\r
      { id: 'dot1x', note: 'Prove you’re allowed on: 802.1X / EAPOL keeps the port blocked until you authenticate (often to a RADIUS server) — the gate on enterprise wifi and wired ports.' },\r
      { id: 'wpa', note: 'Derive the wifi keys: the WPA2 four-way handshake turns the shared secret into fresh per-session encryption keys, so the air link is encrypted and replay-proof.' },\r
      { id: 'dhcp', note: 'Get an address: DHCP’s discover / offer / request / ack leases you an IP plus the gateway and DNS server — no manual configuration.' },\r
      { id: 'arp', note: 'Find the gateway’s MAC: to reach anything off-subnet, ARP resolves the gateway’s IP to a hardware address so that first frame has somewhere to go.' },\r
    ],\r
  },\r
];\r
`;export{e as default};