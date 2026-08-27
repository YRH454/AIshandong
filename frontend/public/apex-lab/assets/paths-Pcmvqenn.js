var e=`// Guided journeys — curated, ordered walks through existing sections that tell ONE story end to end.\r
// At 170+ sections the flat catalog answers "what is there?" but not "where do I start?"; a journey\r
// answers the second. A path is pure data: an ordered list of section ids, each with a one-line note\r
// on what to watch for. The engine derives the learner's position from the active section (no extra\r
// state), so the same section can live in several journeys. Every step id must be a real section —\r
// enforced by tests/paths.test.ts, the same taxonomy-guard discipline as the nav groups.\r
\r
import { EXTRA_PATHS } from './paths-extra';
import { zhJourneyNote, zhPath } from './zh';
export interface PathStep { id: string; note: string }\r
export interface LearningPath { id: string; title: string; icon: string; blurb: string; steps: PathStep[] }\r
\r
const CORE_PATHS: LearningPath[] = [\r
  {\r
    id: 'https',\r
    title: 'How an HTTPS page loads',\r
    icon: '🌐',\r
    blurb: 'Follow one browser request from a typed name to an encrypted, multiplexed response — the flagship end-to-end story.',\r
    steps: [\r
      { id: 'dns', note: 'Turn the name into an IP — the recursive resolver walks root → TLD → authoritative.' },\r
      { id: 'arp', note: 'Off-subnet traffic still needs the gateway’s MAC — ARP shouts to find it on the LAN.' },\r
      { id: 'tcphand', note: 'A TCP 3-way handshake (SYN / SYN-ACK / ACK) opens the connection before any data.' },\r
      { id: 'certs', note: 'The server proves who it is with a certificate chain back to a trusted root.' },\r
      { id: 'dhkex', note: 'Both sides derive a shared secret over the public channel — the key is never sent.' },\r
      { id: 'aead', note: 'From here every record is encrypted AND authenticated; an eavesdropper sees only ciphertext.' },\r
      { id: 'http2', note: 'The actual GET — multiplexed as HTTP/2 streams over the one encrypted connection.' },\r
      { id: 'cdn', note: 'The response is often served from a nearby CDN edge, not the distant origin.' },\r
      { id: 'conditional', note: 'On the next visit, don’t re-download: conditional requests (If-None-Match / If-Modified-Since) let the server reply 304 Not Modified, and range requests fetch only the missing bytes.' },\r
    ],\r
  },\r
  {\r
    id: 'packet',\r
    title: 'A packet’s journey across the internet',\r
    icon: '📦',\r
    blurb: 'One datagram, hop by hop: from "is this even local?" through NAT, TTL, and BGP to longest-prefix match at every router.',\r
    steps: [\r
      { id: 'subnet', note: 'First question: is the destination on my subnet, or does it go to the gateway?' },\r
      { id: 'arp', note: 'Off-subnet → resolve the gateway’s MAC with ARP to build the L2 frame.' },\r
      { id: 'switch', note: 'The LAN switch forwards by MAC address, learning which port each host is on.' },\r
      { id: 'nat', note: 'At the edge, NAT rewrites your private source IP to a public one.' },\r
      { id: 'ttlhop', note: 'Every router decrements TTL and recomputes the IPv4 header checksum.' },\r
      { id: 'traceroute', note: 'Traceroute weaponizes TTL expiry to reveal each hop along the path.' },\r
      { id: 'bgp', note: 'Between networks, BGP chooses the AS-path the packet will follow.' },\r
      { id: 'routing', note: 'At each hop, longest-prefix match picks the outgoing interface.' },\r
    ],\r
  },\r
  {\r
    id: 'crypto',\r
    title: 'Cryptography from scratch',\r
    icon: '🔒',\r
    blurb: 'Build trust from nothing: perfect secrecy → why classical fails → AES → modes → AEAD → key exchange → public keys → signatures.',\r
    steps: [\r
      { id: 'otpad', note: 'Start with provable perfect secrecy — the one-time pad — and its unforgiving key rule.' },\r
      { id: 'classical', note: 'Classical ciphers fall to frequency analysis; secrecy can’t live in a secret algorithm.' },\r
      { id: 'aesround', note: 'AES: watch SubBytes / ShiftRows / MixColumns / AddRoundKey diffuse one byte across the block.' },\r
      { id: 'ecbpenguin', note: 'A block cipher needs a mode — ECB leaks structure, and the penguin is still visible.' },\r
      { id: 'aead', note: 'AEAD (GCM / ChaCha-Poly) gives confidentiality AND integrity in a single pass.' },\r
      { id: 'dhkex', note: 'Diffie–Hellman lets two strangers agree on a key over a fully public wire.' },\r
      { id: 'rsa', note: 'Public-key crypto: encrypt with the public key, decrypt with the private one.' },\r
      { id: 'millerrabin', note: 'But first you need the primes: Miller–Rabin decides primality in a few exponentiations, so you can pick 2048-bit primes for the key.' },\r
      { id: 'crt', note: 'The Chinese Remainder Theorem behind fast RSA: work mod p and mod q separately, then recombine — ~4× quicker.' },\r
      { id: 'ecdsa', note: 'Sign with elliptic curves — and watch how one reused nonce leaks the private key.' },\r
      { id: 'montladder', note: 'Do the secret exponentiation without leaking it: the Montgomery ladder runs the same operations every bit, constant-time.' },\r
      { id: 'tonelli', note: 'Recover a point from a compressed key: a modular square root (Tonelli–Shanks) turns x and a sign bit back into y = √(x³+ax+b) mod p.' },\r
    ],\r
  },\r
  {\r
    id: 'tcp',\r
    title: 'How TCP delivers a reliable stream',\r
    icon: '🚀',\r
    blurb: 'A lossy, reordering network underneath — yet an ordered, reliable byte stream on top. See every mechanism that makes that true.',\r
    steps: [\r
      { id: 'tcphand', note: 'SYN / SYN-ACK / ACK — both sides agree on their starting sequence numbers.' },\r
      { id: 'flow', note: 'The receive window stops a fast sender from overrunning a slow receiver.' },\r
      { id: 'arq', note: 'Lost a segment? ARQ retransmits — go-back-N versus selective repeat.' },\r
      { id: 'rto', note: 'The retransmission timer adapts to RTT; Karn’s rule avoids ambiguous samples.' },\r
      { id: 'congestion', note: 'Congestion control probes the network: slow-start, then additive-increase / multiplicative-decrease.' },\r
      { id: 'cubic', note: 'CUBIC grows the window along a cubic curve to fill fat, fast links quickly.' },\r
      { id: 'bbr', note: 'BBR models bottleneck bandwidth and RTT instead of treating loss as the only signal.' },\r
      { id: 'sack', note: 'Selective ACK tells the sender exactly which segments already arrived.' },\r
      { id: 'bdp', note: 'How much data should be in flight: the window must cover the bandwidth-delay product (bandwidth × RTT) or the pipe sits half-empty — why long, fast links need large windows.' },\r
    ],\r
  },\r
  {\r
    id: 'database',\r
    title: 'Build a database',\r
    icon: '🗄️',\r
    blurb: 'From a single index on disk to a durable, isolated, replicated, distributed store — the layers a real database is made of.',\r
    steps: [\r
      { id: 'btree', note: 'The B+tree index: how a database finds a row in a handful of disk seeks.' },\r
      { id: 'wal', note: 'Write-ahead logging makes a crash recoverable — log the change first, then apply it.' },\r
      { id: 'mvcc', note: 'MVCC gives each transaction a consistent snapshot without blocking readers.' },\r
      { id: 'locking', note: 'Where snapshots aren’t enough, locks serialize access — and can deadlock.' },\r
      { id: 'serializable', note: 'The correctness those locks enforce: a schedule is safe exactly when its precedence graph is acyclic.' },\r
      { id: 'lsm', note: 'LSM-trees flip the design for write-heavy loads: append to memory, then compact.' },\r
      { id: 'replication', note: 'Ship the WAL to replicas so a copy of the data survives a node loss.' },\r
      { id: 'quorum', note: 'Read/write quorums (R + W > N) keep replicas consistent under failure.' },\r
      { id: 'twopc', note: 'Two-phase commit makes one transaction atomic across several machines.' },\r
      { id: 'threepc', note: 'Three-phase commit adds a pre-commit round so a coordinator crash can’t leave the others blocked forever — the fix for 2PC’s blocking flaw.' },\r
    ],\r
  },\r
  {\r
    id: 'distributed',\r
    title: 'Distributed systems foundations',\r
    icon: '🕸️',\r
    blurb: 'No global clock, no shared memory, nodes that fail — yet the cluster must agree. Walk from ordering time to reaching consensus.',\r
    steps: [\r
      { id: 'lamport', note: 'With no global clock, Lamport timestamps give a consistent "happened-before" order.' },\r
      { id: 'vclock', note: 'Vector clocks go further — they detect when two events are genuinely concurrent.' },\r
      { id: 'quorum', note: 'Quorums (R + W > N) let a replicated store stay consistent without a single leader.' },\r
      { id: 'raft', note: 'Raft elects one leader so a replicated log becomes easy to reason about.' },\r
      { id: 'raftlog', note: 'The leader replicates its log; an entry commits once a majority have stored it.' },\r
      { id: 'paxos', note: 'Paxos is the classic consensus core that Raft repackages to be teachable.' },\r
      { id: 'crdt', note: 'CRDTs let replicas edit independently and always merge without conflict.' },\r
      { id: 'kademlia', note: 'Find data with no central server: a Kademlia DHT routes to whoever holds a key by XOR distance, halving the gap each hop — O(log n) lookups across millions of peers.' },\r
      { id: 'cap', note: 'Under a network partition you must choose: stay consistent, or stay available.' },\r
    ],\r
  },\r
  {\r
    id: 'websec',\r
    title: 'How the browser defends you',\r
    icon: '🛡️',\r
    blurb: 'The web is hostile by default. See the layered defenses — origins, cookies, CSP, isolation, passkeys — and the attacks they stop.',\r
    steps: [\r
      { id: 'cors', note: 'The same-origin policy walls sites off; CORS opens precise, opt-in holes.' },\r
      { id: 'cookies', note: 'Cookies carry the session — and SameSite / HttpOnly decide who can use them.' },\r
      { id: 'csp', note: 'Content-Security-Policy whitelists what may run, blunting injected scripts.' },\r
      { id: 'webinject', note: 'Watch SQLi and XSS land — then the escaping and parameterization that stop them.' },\r
      { id: 'siteisolation', note: 'Site isolation puts each origin in its own process against Spectre-class leaks.' },\r
      { id: 'webauthn', note: 'Passkeys replace passwords with an origin-bound key a phisher can’t relay.' },\r
    ],\r
  },\r
  {\r
    id: 'cpu',\r
    title: 'Inside the CPU',\r
    icon: '🖥️',\r
    blurb: 'How a chip actually runs your code: instructions flowing through a pipeline, guessing branches, juggling caches and memory, up to the OS scheduler.',\r
    steps: [\r
      { id: 'pipeline', note: 'Instructions overlap in a 5-stage pipeline — and stall when one depends on another.' },\r
      { id: 'branchpredict', note: 'A branch’s direction is guessed before it’s known; a 2-bit counter keeps the pipeline full.' },\r
      { id: 'strideprefetch', note: 'The other predictor: spot a constant address stride and fetch the next line before the load asks for it.' },\r
      { id: 'branchless', note: 'When a branch is unpredictable, don’t guess — eliminate it: compute both sides and select with a bitmask or cmov, no misprediction.' },\r
      { id: 'mesi', note: 'Each core caches memory privately; MESI keeps those copies coherent over a snooping bus.' },\r
      { id: 'tso', note: 'Store buffers let a core reorder its own writes — why two threads can both read stale values.' },\r
      { id: 'pagewalk', note: 'Every memory access translates a virtual address through a 4-level page table.' },\r
      { id: 'nestedpaging', note: 'Inside a VM the walk goes two-dimensional — guest and host tables — costing 24 accesses.' },\r
      { id: 'cpusched', note: 'The OS time-slices many processes onto the cores — FCFS, SJF, round-robin.' },\r
      { id: 'cfs', note: 'Linux’s CFS shares the CPU fairly by virtual runtime, weighted by nice value.' },\r
      { id: 'eevdf', note: 'Its successor, EEVDF, adds eligibility and virtual deadlines for a latency bound — the scheduler since 6.6.' },\r
    ],\r
  },\r
  {\r
    id: 'production',\r
    title: 'Operating a service in production',\r
    icon: '🛠️',\r
    blurb: 'The lifecycle of running software reliably: ship it safely, keep it healthy, survive overload, and observe and harden it.',\r
    steps: [\r
      { id: 'deployments', note: 'Roll out v2 without downtime — rolling, blue-green, or canary.' },\r
      { id: 'healthcheck', note: 'Readiness gates traffic; liveness restarts — confusing them causes restart storms.' },\r
      { id: 'autoscale', note: 'Track load by adding and removing replicas with the HPA formula.' },\r
      { id: 'slo', note: 'Turn “be reliable” into an error budget you can spend on features.' },\r
      { id: 'loadshed', note: 'Under overload, shed fast — queuing everything collapses goodput.' },\r
      { id: 'idempotency', note: 'Make retries safe so a lost response can’t double-charge.' },\r
      { id: 'tracing', note: 'Follow one request across services to see where the latency really goes.' },\r
      { id: 'chaos', note: 'Inject failures on purpose to prove the blast radius is contained.' },\r
    ],\r
  },\r
  {\r
    id: 'mlclassify',\r
    title: 'How machines learn to classify',\r
    icon: '🧠',\r
    blurb: 'From one neuron to tree ensembles — how supervised classifiers draw the boundary between classes, each method fixing the last one’s limitation.',\r
    steps: [\r
      { id: 'perceptron', note: 'The first neuron: one line, learning from its mistakes — but it can’t separate XOR.' },\r
      { id: 'logisticregression', note: 'Keep the line, but output a probability, trained on a convex loss that always converges.' },\r
      { id: 'svm', note: 'Among all separating lines, pick the widest-margin one — pinned by just a few support vectors.' },\r
      { id: 'decisiontree', note: 'Swap lines for yes/no questions: axis-aligned regions that even solve the XOR a perceptron can’t.' },\r
      { id: 'randomforest', note: 'One deep tree overfits; average many decorrelated trees to slash the variance.' },\r
      { id: 'gradientboosting', note: 'Or add shallow trees in sequence, each fitting the errors the last one left behind.' },\r
    ],\r
  },\r
  {\r
    id: 'mlstructure',\r
    title: 'Finding structure without labels',\r
    icon: '🔍',\r
    blurb: 'Unsupervised learning: compress the dimensions, then find clusters by centers, by density, and by probability — no labels required.',\r
    steps: [\r
      { id: 'pca', note: 'Compress high-dimensional data onto the few axes it actually varies along.' },\r
      { id: 'kmeans', note: 'Partition the points into k round clusters, each owned by its nearest center.' },\r
      { id: 'dbscan', note: 'Cluster by density instead — clusters of any shape, with outliers left labeled as noise.' },\r
      { id: 'gmm', note: 'Soft, elliptical clusters via Expectation-Maximization; k-means is the hard-assignment special case.' },\r
    ],\r
  },\r
  {\r
    id: 'exploits',\r
    title: 'Breaking a program: exploits & defenses',\r
    icon: '💥',\r
    blurb: 'The attacker–defender arms race, from a stack buffer overflow up through ASLR and CFI to the CPU speculation attacks that leak beneath them all. Sandboxed and conceptual.',\r
    steps: [\r
      { id: 'bufferoverflow', note: 'Overflow a stack buffer to overwrite the saved return address and hijack control flow.' },\r
      { id: 'nxbit', note: 'First defense: mark the stack non-executable so injected shellcode can’t run as code.' },\r
      { id: 'rop', note: 'Defeat NX by chaining gadgets — snippets of existing code that each end in a return.' },\r
      { id: 'aslr', note: 'Randomize the address layout so the attacker can’t find those gadgets in the first place.' },\r
      { id: 'stackcanary', note: 'A random guard between the locals and the return address; the linear overflow smashes it and aborts.' },\r
      { id: 'cfi', note: 'Verify every indirect call and return lands on a legitimate target, not an attacker’s.' },\r
      { id: 'spectre', note: 'Even with perfect software defenses, speculation leaks secrets through cache timing.' },\r
      { id: 'meltdown', note: 'Out-of-order execution reads across the user/kernel boundary — fixed only by unmapping the kernel.' },\r
    ],\r
  },\r
  {\r
    id: 'sketches',\r
    title: 'Approximate answers in tiny memory',\r
    icon: '📊',\r
    blurb: 'Trade exactness for space: four probabilistic sketches that answer membership, frequency, cardinality, and similarity in a fraction of the memory, with tunable error.',\r
    steps: [\r
      { id: 'bloom', note: 'Membership in a few bits per element — no false negatives, tunable false positives, and it never stores the items themselves.' },\r
      { id: 'countmin', note: 'The frequency of each item in a high-volume stream, in sublinear space — counts that can overestimate but never miss.' },\r
      { id: 'hll', note: 'Count distinct items (cardinality) in kilobytes even for billions, from the longest run of leading zeros in their hashes.' },\r
      { id: 'minhash', note: 'Estimate how similar two sets are (their Jaccard overlap) from a handful of min-hashes — the engine of near-duplicate detection.' },\r
    ],\r
  },\r
  {\r
    id: 'randomized',\r
    title: 'Randomness as an algorithm',\r
    icon: '🎲',\r
    blurb: 'Randomness isn’t just noise — it’s a tool. Estimate, sample from a stream, draw by weight, shuffle fairly, and fit through outliers, each solved cleanly by the controlled use of chance.',\r
    steps: [\r
      { id: 'montecarlo', note: 'Estimate a quantity by random sampling — throw darts to get π, with error shrinking as 1/√N in any number of dimensions.' },\r
      { id: 'reservoir', note: 'Sample k items uniformly from a stream of unknown length, in a single pass and O(k) memory.' },\r
      { id: 'aliasmethod', note: 'Draw from a weighted distribution in O(1) — one die roll plus one coin flip, after a clever setup.' },\r
      { id: 'shuffle', note: 'Shuffle an array so every permutation is equally likely (Fisher–Yates) — and the subtle bias of doing it the wrong way.' },\r
      { id: 'ransac', note: 'Fit a model despite 50% outliers by random sampling plus consensus — where averaging with least-squares gets dragged off.' },\r
      { id: 'wfc', note: 'Generate structure with chance: wave function collapse makes a random choice at the most-constrained cell and propagates, building a rule-abiding map.' },\r
    ],\r
  },\r
  {\r
    id: 'language',\r
    title: 'How your code actually runs',\r
    icon: '⚙️',\r
    blurb: 'Follow a line of source from characters to running native code: lex it, parse it, compile it, run it on a VM, JIT the hot paths, and let the collector reclaim memory.',\r
    steps: [\r
      { id: 'dfa', note: 'Lexing: a finite-state machine scans characters into tokens — numbers, names, operators — in one linear pass.' },\r
      { id: 'shuntingyard', note: 'Parsing: shunting-yard turns infix tokens into unambiguous postfix, resolving precedence with a stack.' },\r
      { id: 'compiler', note: 'Codegen: walk the parsed expression and emit the actual machine instructions a CPU runs.' },\r
      { id: 'ssa', note: 'The optimizer’s form: rename each variable to a single-assignment version, with φ nodes at branch joins, so every use has one definition.' },\r
      { id: 'hindley', note: 'Type-checking: Hindley-Milner infers every type from usage alone, catching mismatches before a line runs.' },\r
      { id: 'regalloc', note: 'A backend pass fits the code’s unlimited temporaries into the CPU’s few registers by coloring an interference graph.' },\r
      { id: 'peephole', note: 'The last polish: a sliding window rewrites local patterns into cheaper ones — mul by a power of two becomes a shift, no-ops vanish.' },\r
      { id: 'bytecode', note: 'Or target a portable bytecode and run it on a stack VM — how the JVM and CPython execute.' },\r
      { id: 'jit', note: 'Hot bytecode is compiled to native code at runtime — profile, specialize, and patch the call site.' },\r
      { id: 'wasm', note: 'A portable compile target: WebAssembly is a compact, sandboxed bytecode that runs untrusted code at near-native speed in the browser and beyond.' },\r
      { id: 'gc', note: 'The runtime reclaims unreachable memory automatically, so the program never has to free by hand.' },\r
    ],\r
  },\r
  {\r
    id: 'graphics',\r
    title: 'How a screen gets drawn',\r
    icon: '🎨',\r
    blurb: 'From the humblest pixel line to photorealistic rays: the primitives and paradigms that turn geometry and math into the image on your display.',\r
    steps: [\r
      { id: 'bresenham', note: 'The humblest primitive: draw a straight line on a pixel grid with nothing but integer adds.' },\r
      { id: 'bezier', note: 'Smooth curves from a few control points — every font glyph and SVG path is Béziers.' },\r
      { id: 'perspective', note: 'Project the 3D scene onto the 2D screen by dividing by depth — and interpolate perspective-correctly, or the texture warps.' },\r
      { id: 'rasterize', note: 'Fill a triangle by testing pixels against its edges — the primitive every GPU is built around.' },\r
      { id: 'raytracing', note: 'The other paradigm: trace a ray from the eye through each pixel to find what it hits.' },\r
      { id: 'raymarch', note: 'March along each ray in steps sized by a signed-distance field — the shader and demoscene way.' },\r
      { id: 'perlin', note: 'Procedural noise builds textures, terrain, and clouds — infinite detail with no stored image.' },\r
    ],\r
  },\r
  {\r
    id: 'compression',\r
    title: 'Compression: keep what matters',\r
    icon: '🗜️',\r
    blurb: 'How data shrinks — from lossless codes that give back every bit, through repeat-finding and byte-reordering, to lossy schemes that throw away exactly what you won’t miss.',\r
    steps: [\r
      { id: 'huffman', note: 'Lossless entropy coding: give frequent symbols shorter codes with an optimal prefix tree.' },\r
      { id: 'lz77', note: 'Replace repeated substrings with back-references to earlier text — the core of gzip and zip.' },\r
      { id: 'bwt', note: 'The Burrows-Wheeler transform reversibly clusters similar bytes so the coder compresses harder (bzip2).' },\r
      { id: 'jpeg', note: 'Go lossy for images: the DCT concentrates energy into low frequencies you can quantize away.' },\r
      { id: 'svd', note: 'Low-rank approximation keeps only an image’s top singular values — the provably optimal rank-k.' },\r
    ],\r
  },\r
  {\r
    id: 'strings',\r
    title: 'Searching and assembling text',\r
    icon: '🔤',\r
    blurb: 'Work with sequences at scale: find one pattern without backtracking, match thousands at once, index every suffix, search inside compressed data, and reassemble a whole sequence from fragments.',\r
    steps: [\r
      { id: 'kmp', note: 'Find a pattern in text without ever backtracking, using a precomputed failure function.' },\r
      { id: 'rabinkarp', note: 'A rolling hash slides a fingerprint along the text to spot candidate matches in O(1) per step.' },\r
      { id: 'ahocorasick', note: 'Match thousands of patterns at once with a trie threaded by failure links.' },\r
      { id: 'suffixarray', note: 'Sort all suffixes once, then answer any substring query by binary search.' },\r
      { id: 'bwt', note: 'The Burrows-Wheeler transform powers the FM-index — full-text search inside compressed data.' },\r
      { id: 'debruijn', note: 'Assemble a whole sequence from short overlapping k-mers by walking an Eulerian path.' },\r
    ],\r
  },\r
  {\r
    id: 'dp',\r
    title: 'Dynamic programming everywhere',\r
    icon: '🧩',\r
    blurb: 'One idea — build the answer from overlapping subproblems and never recompute one twice — solves a startling range of problems. Watch the same table-filling logic reappear across sequences, images, and probabilities.',\r
    steps: [\r
      { id: 'lis', note: 'The core move: the best answer ending here is built from the best answers before it (longest increasing subsequence).' },\r
      { id: 'knapsack', note: 'DP over choices: a table of best value per weight budget, each cell reusing smaller ones.' },\r
      { id: 'editdist', note: 'DP over two sequences: the cheapest edits to turn one string into another, one cell per prefix pair.' },\r
      { id: 'diff', note: 'The same longest-common-subsequence DP is exactly how git diff lines up two files.' },\r
      { id: 'seamcarve', note: 'DP over a pixel grid: the least-energy connected seam, for content-aware image resizing.' },\r
      { id: 'viterbi', note: 'DP over a probability trellis: the single most likely hidden sequence — speech, decoding, tagging.' },\r
    ],\r
  },\r
  {\r
    id: 'iterative',\r
    title: 'How computers converge on an answer',\r
    icon: '🔁',\r
    blurb: 'Most real math has no closed form, so computers iterate: start with a guess and improve it until it stops changing. Five very different problems, all solved by convergence.',\r
    steps: [\r
      { id: 'newton', note: 'Root-finding by tangent steps — the correct digits roughly double each iteration (quadratic convergence).' },\r
      { id: 'conjgrad', note: 'Solve a linear system Ax=b by conjugate directions — exact in n steps, far fewer when preconditioned.' },\r
      { id: 'pagerank', note: 'Find a matrix’s dominant eigenvector by multiplying repeatedly — the random surfer’s stationary distribution.' },\r
      { id: 'kmeans', note: 'Alternate assign-to-nearest and move-the-center until the clustering stops changing.' },\r
      { id: 'montecarlo', note: 'When you can’t integrate, sample at random — the estimate’s error shrinks as 1/√N.' },\r
      { id: 'simplex', note: 'Optimization converges too: simplex walks vertex to vertex of the feasible region, each step raising the objective until no neighbour is higher — the optimum.' },\r
      { id: 'kalman', note: 'Estimation as iteration: a Kalman filter refines its guess every step, blending its prediction and each measurement by their uncertainties toward the true state.' },\r
    ],\r
  },\r
  {\r
    id: 'memory',\r
    title: 'Allocating and reclaiming memory',\r
    icon: '🧹',\r
    blurb: 'A program asks for memory and later stops using it — but how is it handed out, and how does the system know when it’s free again? Allocation, then three ways to reclaim, each fixing the last one’s blind spot.',\r
    steps: [\r
      { id: 'buddyalloc', note: 'Allocation: the kernel hands out memory in power-of-two blocks, splitting and merging buddies to fight fragmentation.' },\r
      { id: 'arena', note: 'The opposite extreme: one block, one bump pointer, no per-object free — reset the whole arena at once when the request or frame ends.' },\r
      { id: 'refcount', note: 'The simplest reclaim: count references and free at zero — but a reference cycle keeps itself alive and leaks.' },\r
      { id: 'gc', note: 'Tracing mark-and-sweep collects from the roots instead, so it reclaims the cycles reference counting can’t.' },\r
      { id: 'cheney', note: 'A copying collector goes further — it relocates the survivors into a fresh space, compacting fragmentation away.' },\r
      { id: 'ownership', note: 'Or reclaim at compile time: Rust’s ownership and borrow rules let the compiler insert every free automatically — no GC pauses, no leaks, no use-after-free.' },\r
    ],\r
  },\r
  {\r
    id: 'query',\r
    title: 'How a database answers a query',\r
    icon: '📇',\r
    blurb: 'The read path: find the rows with an index, combine tables with a join, handle inputs far bigger than memory, and let the planner pick the cheapest way to do it all.',\r
    steps: [\r
      { id: 'btree', note: 'The B+tree index finds a row by sorted key in a handful of disk seeks — the default database index.' },\r
      { id: 'exthash', note: 'A hash index finds rows by exact key and grows without rehashing, splitting one bucket at a time.' },\r
      { id: 'joins', note: 'Combine two tables on a key — nested-loop, hash, or sort-merge, all returning the same rows at different costs.' },\r
      { id: 'gracejoin', note: 'When both tables dwarf memory, partition by hash and join the aligned partition-pairs one at a time.' },\r
      { id: 'queryplan', note: 'The optimizer estimates the cost of each index and join order, then picks the cheapest plan to execute.' },\r
    ],\r
  },\r
  {\r
    id: 'moderncrypto',\r
    title: 'Cryptography beyond secrecy',\r
    icon: '🔏',\r
    blurb: 'Crypto is more than hiding messages. Commit to a value, prove membership, transfer a choice obliviously, generate verifiable randomness — then go post-quantum and meet the lattice attack that sets the bar.',\r
    steps: [\r
      { id: 'pedersen', note: 'A commitment locks in a value you can’t change but haven’t revealed — Pedersen commitments are perfectly hiding, computationally binding.' },\r
      { id: 'merkle', note: 'A Merkle tree commits to a whole set with one hash and proves any member belongs with a short path.' },\r
      { id: 'accumulator', note: 'An RSA accumulator commits to a set with one number and proves membership with one number — constant size, no growing path.' },\r
      { id: 'ot', note: 'Oblivious transfer: the sender offers two messages, the receiver takes one, and neither learns the other’s choice — the seed of secure computation.' },\r
      { id: 'garbled', note: 'Yao garbled circuits build on OT: two parties compute f(a,b) revealing neither input, by evaluating an encrypted, shuffled gate.' },\r
      { id: 'vrf', note: 'A verifiable random function emits randomness plus a proof it was computed correctly — unpredictable yet checkable.' },\r
      { id: 'sumcheck', note: 'The sumcheck protocol proves a huge sum over 2ⁿ inputs in n cheap rounds and one evaluation — the engine inside modern SNARKs.' },\r
      { id: 'vdf', note: 'A verifiable delay function forces a fixed sequential compute (repeated squaring) that a tiny proof checks fast — unbiasable randomness beacons.' },\r
      { id: 'pqc', note: 'Post-quantum encryption hides a bit in noise (Learning With Errors), staying secure even against a quantum computer.' },\r
      { id: 'lll', note: 'And the attack that sets the bar: LLL reduces a lattice basis to find short vectors — why lattice crypto needs hundreds of dimensions.' },\r
    ],\r
  },\r
  {\r
    id: 'privacy',\r
    title: 'Privacy beyond encryption',\r
    icon: '🕶️',\r
    blurb: 'Encryption hides the contents of your data — but not the statistics you publish, the computation you run, the queries you make, or the blocks you touch. Four techniques that hide those too.',\r
    steps: [\r
      { id: 'diffpriv', note: 'Publish statistics about a group while provably hiding every individual — add calibrated Laplace noise (differential privacy).' },\r
      { id: 'garbled', note: 'Compute a function of two parties’ secret inputs, revealing neither — Yao garbled circuits.' },\r
      { id: 'pir', note: 'Fetch a record from a database without the server learning which record you asked for.' },\r
      { id: 'oram', note: 'Hide even your access pattern to your own outsourced storage — every access looks like a random path.' },\r
    ],\r
  },\r
  {\r
    id: 'arithmetic',\r
    title: 'From transistors to matrix multiply',\r
    icon: '🔢',\r
    blurb: 'Build arithmetic from the bottom up: a transistor is a switch, switches make an adder, an adder plus logic makes an ALU, a tree of adders multiplies fast, and a grid of multiply-accumulate cells becomes the matrix engine inside a TPU.',\r
    steps: [\r
      { id: 'transistor', note: 'The switch: a voltage on the gate opens or closes a channel — the physical 1s and 0s under everything else.' },\r
      { id: 'adder', note: 'Wire gates into a binary adder; the carry ripples (or looks ahead) to sum two numbers bit by bit.' },\r
      { id: 'alu', note: 'The compute core: an adder plus logic gates and a mux the opcode uses to pick add/sub/and/or/shift, raising the flags.' },\r
      { id: 'wallace', note: 'Multiplication done fast: a Wallace tree reduces the partial-product dot diagram with carry-save adders in O(log n) depth.' },\r
      { id: 'systolic', note: 'Now tile multiply-accumulate cells into a grid: data flows through and a whole matrix multiply falls out — the heart of a TPU.' },\r
    ],\r
  },\r
  {\r
    id: 'sortselect',\r
    title: 'How computers sort and select',\r
    icon: '📊',\r
    blurb: 'From the five textbook sorts to the one in your standard library, then the flip side: finding the k-th element without sorting at all. Partitioning is the thread that ties them together.',\r
    steps: [\r
      { id: 'sorting', note: 'The five textbook sorts — bubble, insertion, selection, merge, quicksort — and the O(n²) vs O(n log n) gap between them.' },\r
      { id: 'timsort', note: 'The real-world hybrid (Python, Java, Rust default): exploit natural runs, merge in balanced order, gallop — adaptive and stable.' },\r
      { id: 'dnf', note: 'Dutch national flag: partition into <, =, > a pivot in one linear pass — the three-way split quicksort and selection lean on.' },\r
      { id: 'quickselect', note: 'Don’t sort to find the k-th element — partition and recurse into only the side that holds it, O(n) on average.' },\r
      { id: 'medianofmedians', note: 'Choose the pivot as a median of medians and quickselect becomes O(n) even in the worst case — a provably good split.' },\r
      { id: 'heap', note: 'A binary heap keeps the min or max at the root in O(log n) — heapsort, and the priority queue behind schedulers and Dijkstra.' },\r
      { id: 'pairingheap', note: 'When a plain heap can’t merge, a pairing heap does: meld two heaps in O(1), and decrease-key by cutting a node’s subtree out and melding it back at the root — the operations Dijkstra and Prim lean on.' },\r
    ],\r
  },\r
  {\r
    id: 'searching',\r
    title: 'How computers search for a solution',\r
    icon: '🧭',\r
    blurb: 'Most hard problems are a search through an enormous space of possibilities. The art is not visiting all of it — heuristics to aim, pruning to skip, propagation to shrink, and randomness to escape when exact search is hopeless.',\r
    steps: [\r
      { id: 'astar', note: 'Informed search: A* aims toward the goal with a heuristic, expanding far fewer nodes than blind breadth-first while still finding the shortest path.' },\r
      { id: 'alphabeta', note: 'Adversarial search: explore a game tree, but prune whole branches that provably can’t change the decision (alpha-beta) — searching deeper for free.' },\r
      { id: 'dpll', note: 'Systematic search: DPLL tries a variable, propagates forced consequences (unit propagation), and backtracks on conflict — the backbone of SAT solvers.' },\r
      { id: 'twosat', note: 'When structure helps: 2-SAT looks NP-hard but the implication graph makes it linear-time — the right model collapses the search entirely.' },\r
      { id: 'wfc', note: 'Constraint propagation as generation: collapse the most-constrained choice, then ripple the consequences outward — arc-consistency building a valid pattern.' },\r
      { id: 'simanneal', note: 'When exact is hopeless: wander the space accepting occasional worse moves, cooling over time — stochastic local search that escapes local optima.' },\r
    ],\r
  },\r
  {\r
    id: 'digitalaudio',\r
    title: 'How digital audio works',\r
    icon: '🎧',\r
    blurb: 'A sound is just a list of numbers. Analyze it into frequencies, hear its pitch, synthesize new timbres from scratch, place it in a room, and shrink it by an order of magnitude — the signal-processing pipeline behind every note you hear from a computer.',\r
    steps: [\r
      { id: 'fft', note: 'Every sound is a sum of pure tones. The FFT converts between the waveform (samples in time) and its spectrum (how much of each frequency) in O(n log n) — the lens for everything else.' },\r
      { id: 'pitch', note: 'What note is this? Autocorrelation slides a sound against itself and finds the lag where it best repeats — that period is the pitch a tuner shows.' },\r
      { id: 'goertzel', note: 'Detecting one specific tone — a phone touch-tone — doesn’t need a full FFT: the Goertzel algorithm evaluates a single frequency bin with a tiny recurrence.' },\r
      { id: 'karplus', note: 'Synthesize a plucked string from almost nothing: fill a short delay line with noise and feed it back through a lowpass — the Karplus–Strong pluck.' },\r
      { id: 'adsr', note: 'Shape the raw tone into a note: an ADSR envelope swells and fades the amplitude (attack, decay, sustain, release) so it doesn’t click and sounds like a pluck or a pad.' },\r
      { id: 'fmsynth', note: 'Wobble one oscillator’s frequency with another and rich Bessel-weighted sidebands bloom — Chowning’s FM synthesis, the sound of the DX7.' },\r
      { id: 'convreverb', note: 'Put a dry sound in a cathedral by convolving it with the room’s impulse response — every echo of the space applied at once.' },\r
      { id: 'biquad', note: 'Shape the tone with a filter: a two-pole biquad passes or cuts bands (lowpass, notch, resonant peak) — the unit cell of every EQ and synth filter.' },\r
      { id: 'mp3', note: 'Shrink audio ~10× by discarding what the ear can’t hear: psychoacoustic masking drops quiet tones hidden next to loud ones.' },\r
    ],\r
  },\r
  {\r
    id: 'blackhat',\r
    title: 'Zero to black hat: from bits to breaking',\r
    icon: '🎯',\r
    blurb: 'The whole climb, no prior knowledge assumed. Start at what a byte is; learn how a program lives in memory, how data crosses a network, and how encryption actually works — then break each one using the exact concept you just learned. Every attack is preceded by the thing it exploits, so you see WHY it works, not just that it does. Sandboxed and conceptual throughout.',\r
    steps: [\r
      // the substrate — bits, and how a computer runs\r
      { id: 'encoding', note: 'Start here: everything a computer touches is bytes. See how text and numbers become the bits an attacker ultimately manipulates.' },\r
      { id: 'cpucycle', note: 'How a CPU actually runs your code — fetch, decode, execute — register by register. Every exploit is just making it run the wrong instructions.' },\r
      { id: 'pagewalk', note: 'Programs don’t see real memory; they see virtual addresses translated through page tables — the map an attacker learns to read and forge.' },\r
      { id: 'memlayout', note: 'How one process is laid out in memory — code and globals at the bottom, the heap growing up, the stack of function calls growing down. Each frame holds the return address the very first exploit overwrites.' },\r
      { id: 'syscall', note: 'How a program crosses into the kernel to do anything real. That user↔kernel boundary is the line half of these attacks try to cross.' },\r
      // how data moves across a network\r
      { id: 'network', note: 'Zoom out: how machines on a wire find each other and pass packets. Every network attack is a lie told somewhere in this flow.' },\r
      { id: 'arp', note: 'On a LAN, a machine asks “who has this IP?” and trusts whoever answers. Hold onto that trust — it is the whole of ARP spoofing later.' },\r
      { id: 'tcphand', note: 'Two machines set up a reliable stream with a three-way handshake before any data flows — the connection an attacker wants to hijack or reset.' },\r
      { id: 'dns', note: 'A name becomes an address through the internet’s trusted lookup. Poison that lookup and you redirect everyone — the DNS attacks build on this.' },\r
      // the crypto that protects it, from scratch\r
      { id: 'crypto', note: 'What encryption actually is — confusion, diffusion, and a key. No formulas assumed; build the intuition the later attacks will target.' },\r
      { id: 'aead', note: 'Modern encryption doesn’t just hide data, it authenticates it. Understand what the tag protects — and what happens when a mode gets it wrong.' },\r
      { id: 'hashint', note: 'A hash is a one-way fingerprint everything leans on — passwords, signatures, integrity. Its properties, and where they break, drive several attacks.' },\r
      { id: 'pubkey', note: 'The counter-intuitive trick that lets two strangers who’ve never met share a secret over an open wire: a public key and a private one.' },\r
      { id: 'dhkex', note: 'Diffie–Hellman in the flesh — agree on a shared key in the open. Its hardness assumption is exactly what the discrete-log attack tries to break.' },\r
      { id: 'tlsflow', note: 'How the browser and server tie all of the above into one secure handshake — so you can then see precisely where a downgrade attack cuts in.' },\r
      // break the web\r
      { id: 'webinject', note: 'The most common attack there is: when user input is treated as code. Type the SQL and the script yourself and watch authentication fall.' },\r
      { id: 'ssrf', note: 'Turn the server’s own network access against it — reach the cloud metadata endpoint it can see and you can’t. Encode the IP to slip the filter.' },\r
      { id: 'jwt', note: 'Forge a login token when the server trusts the token to say how it should be checked — flip the algorithm to “none” and become admin.' },\r
      { id: 'protopollute', note: 'Poison JavaScript’s shared prototype with attacker JSON, and every object in the program — even ones created later — inherits your properties.' },\r
      // break the program\r
      { id: 'bufferoverflow', note: 'Now the classic: overflow a stack buffer (you met the stack above) and overwrite the saved return address to hijack control flow.' },\r
      { id: 'rop', note: 'Defenders make the stack non-executable so you can’t inject code. Answer: chain gadgets — snippets of the program’s OWN code — into a new program.' },\r
      { id: 'aslr', note: 'So they randomize where everything lives and your gadgets vanish. See the cat-and-mouse: leak one address and the whole map comes back.' },\r
      { id: 'spectre', note: 'Even with perfect software defenses, the CPU’s own speculation leaks secrets through cache timing — an attack beneath the code entirely.' },\r
      // break the crypto\r
      { id: 'paddingoracle', note: 'You don’t always need the key. A single “bad padding” error, asked enough times, decrypts the ciphertext one byte at a time.' },\r
      { id: 'ecdsa', note: 'Signatures are unforgeable — unless the signer reuses a random nonce. Two such signatures and the private key falls out with algebra.' },\r
      { id: 'bsgs', note: 'Crack a discrete log by meeting in the middle — and see exactly why a real 256-bit key stays out of reach while a toy one falls in seconds.' },\r
      { id: 'tlsdowngrade', note: 'Strip the strong ciphers to force an export-grade handshake, then break it and forge the integrity check — this is how FREAK and Logjam worked.' },\r
      // break the network, then step back\r
      { id: 'arpspoof', note: 'Cash in that ARP trust: forge the replies and every packet on the LAN routes through you — the man in the middle, produced.' },\r
      { id: 'kaminsky', note: 'Poison a resolver’s DNS cache and you redirect a whole network to your servers — the lookup you learned at the start, weaponized.' },\r
      { id: 'killchain', note: 'Step all the way back: how a real intrusion chains reconnaissance → exploitation → command-and-control → action, and where defense-in-depth breaks it.' },\r
    ],\r
  },\r
  {\r
    id: 'anonymity',\r
    title: 'How torrents & anonymity work',\r
    icon: '🧅',\r
    blurb: 'The technology the file-sharing generation lived on: a distributed hash table finds peers with no central server, torrents move files across a swarm, and onion routing hides who is talking to whom — down to a server with no address at all.',\r
    steps: [\r
      { id: 'kademlia', note: 'First, how a network finds things with no central index: a distributed hash table (Kademlia) locates whoever holds a key by XOR-distance, in a logarithmic number of hops.' },\r
      { id: 'bittorrent', note: 'A file split into pieces, pulled from a swarm of peers at once — rarest piece first, uploads traded tit-for-tat. No server to overload or seize.' },\r
      { id: 'magnet', note: 'Drop the tracker entirely: a magnet link is just an infohash (a content address), and the DHT above finds the peers. Nothing to host, nothing to take down.' },\r
      { id: 'tor', note: 'Now hide WHO is talking: wrap your traffic in layers of encryption through a 3-hop circuit, so no single relay links you to your destination.' },\r
      { id: 'censorship', note: 'When a firewall blocks Tor itself, disguise the traffic — obfs4 makes it look random, bridges are unlisted entry points, domain fronting hides behind a CDN.' },\r
      { id: 'onionservice', note: 'Finally hide the SERVER too: an onion service has no public IP, and a rendezvous meeting means neither side ever learns the other’s location — censorship-resistant publishing.' },\r
      { id: 'trafficcorr', note: 'The attack that sets the limit: watch the flow entering the network and the flows leaving it, and match their timing shape — no decryption needed. Play the adversary and link the two ends yourself.' },\r
      { id: 'mixnet', note: 'The defense against that attack: a mix network destroys the shape — batch, reorder, delay, pad — buying an anonymity set no low-latency system can, at the cost of latency.' },\r
    ],\r
  },\r
];\r
\r
// The upstream path data remains the source of truth for ordering.  Translate
// the copy at the catalogue boundary so every card, preview and journey bar
// reads consistently in Chinese.
export const PATHS: LearningPath[] = [...CORE_PATHS, ...EXTRA_PATHS].map((path) => ({
  ...path,
  ...zhPath(path.id, path.title, path.blurb),
  steps: path.steps.map((step) => ({ ...step, note: zhJourneyNote(step.id) })),
}));
\r
export const pathById: Record<string, LearningPath> = Object.fromEntries(PATHS.map((p) => [p.id, p]));\r
\r
/** A few flagship journeys surfaced as "start here" above the full list. */\r
export const FEATURED_JOURNEYS = ['blackhat', 'anonymity', 'https', 'cpu', 'database'];\r
\r
/** The index of \`sectionId\` within a path's steps, or -1 if the learner has stepped off the path. */\r
export function stepIndexOf(path: LearningPath, sectionId: string): number {\r
  return path.steps.findIndex((s) => s.id === sectionId);\r
}\r
`;export{e as default};