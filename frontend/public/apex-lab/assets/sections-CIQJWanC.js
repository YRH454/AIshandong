var e=`// Sidebar taxonomy — every section grouped into collapsible categories so the nav stays navigable. Pure data
// plus a tiny lookup, kept here (and tested) so the grouping can't silently drift out of sync with the sections
// themselves. (For the live count, run \`npm run stats\` — nothing here hardcodes it.)

import { zhSection } from './zh';
\r
export interface SectionMeta { id: string; label: string; icon: string }\r
\r
const RAW_SECTION_META: SectionMeta[] = [
  { id: 'playground', label: 'Playground (run JS)', icon: '🛝' },\r
  { id: 'network', label: 'Network', icon: '🌐' },\r
  { id: 'switch', label: 'L2 switch', icon: '🔌' },\r
  { id: 'dhcp', label: 'DHCP (DORA)', icon: '📨' },\r
  { id: 'nat', label: 'NAT / PAT', icon: '🔀' },\r
  { id: 'ttlhop', label: 'TTL & checksum', icon: '⏬' },\r
  { id: 'traceroute', label: 'Traceroute', icon: '🛰️' },\r
  { id: 'subnet', label: 'Subnetting', icon: '🧮' },\r
  { id: 'pmtud', label: 'Path MTU Discovery', icon: '📏' },\r
  { id: 'fragment', label: 'IP fragmentation', icon: '🧩' },\r
  { id: 'natpunch', label: 'NAT traversal', icon: '🕳️' },\r
  { id: 'ipcompare', label: 'IPv4 vs IPv6', icon: '⇄' },\r
  { id: 'happyeyeballs', label: 'Happy Eyeballs', icon: '👀' },\r
  { id: 'sctp', label: 'SCTP multi-homing', icon: '🔀' },\r
  { id: 'mptcp', label: 'Multipath TCP', icon: '🔀' },\r
  { id: 'nagle', label: 'Nagle & delayed ACK', icon: '🐢' },\r
  { id: 'sws', label: 'Silly window syndrome', icon: '🪟' },\r
  { id: 'icmp', label: 'ICMP messages', icon: '🚨' },\r
  { id: 'anycast', label: 'Anycast', icon: '📡' },\r
  { id: 'multicast', label: 'Multicast & IGMP', icon: '📡' },\r
  { id: 'wpa', label: 'WPA2 handshake', icon: '📶' },\r
  { id: 'dot1x', label: '802.1X / EAPOL', icon: '🔌' },\r
  { id: 'vlan', label: 'VLAN tagging', icon: '🏷️' },\r
  { id: 'ntp', label: 'NTP clock sync', icon: '🕰️' },\r
  { id: 'gps', label: 'How GPS finds your position', icon: '🎬' },\r
  { id: 'btree', label: 'B+tree index', icon: '🌲' },\r
  { id: 'exthash', label: 'How a hash index grows (extendible hashing)', icon: '🎬' },\r
  { id: 'gitobjects', label: 'How Git stores your code', icon: '🎬' },\r
  { id: 'pagereplace', label: 'Page replacement', icon: '📄' },\r
  { id: 'lsm', label: 'LSM-tree', icon: '🪵' },\r
  { id: 'mvcc', label: 'MVCC isolation', icon: '🔀' },\r
  { id: 'wal', label: 'Write-Ahead Log', icon: '📒' },\r
  { id: 'skiplist', label: 'Skip list', icon: '🪜' },\r
  { id: 'locking', label: 'Locking & deadlock', icon: '🔒' },\r
  { id: 'serializable', label: 'When is an interleaving safe? (conflict serializability)', icon: '🎬' },\r
  { id: 'joins', label: 'Join algorithms', icon: '🔗' },\r
  { id: 'gracejoin', label: 'How to join tables bigger than RAM (grace hash join)', icon: '🎬' },\r
  { id: 'queryplan', label: 'Query planner (cost)', icon: '🧠' },\r
  { id: 'rum', label: 'RUM amplification', icon: '⚖️' },\r
  { id: 'trie', label: 'Trie (prefix tree)', icon: '🌿' },\r
  { id: 'hamt', label: 'HAMT (persistent map)', icon: '🍂' },\r
  { id: 'hashtable', label: 'Hash table collisions', icon: '🗃️' },\r
  { id: 'cuckoo', label: 'Cuckoo hashing', icon: '🐦' },\r
  { id: 'cuckoofilter', label: 'Cuckoo filter', icon: '🪶' },\r
  { id: 'robinhood', label: 'Robin Hood hashing', icon: '🏹' },\r
  { id: 'geohash', label: 'Geohashing', icon: '🌍' },\r
  { id: 'kdtree', label: 'k-d tree (nearest neighbor)', icon: '📍' },\r
  { id: 'unionfind', label: 'Union-Find', icon: '🔗' },\r
  { id: 'fenwick', label: 'Fenwick tree', icon: '🌴' },\r
  { id: 'sparsetable', label: 'Sparse table (RMQ)', icon: '⚡' },\r
  { id: 'cartesian', label: 'Cartesian tree (RMQ=LCA)', icon: '🌲' },\r
  { id: 'roaring', label: 'Roaring bitmaps', icon: '🧲' },\r
  { id: 'bitmapindex', label: 'Bitmap index', icon: '🗂️' },\r
  { id: 'columnar', label: 'Columnar storage (Parquet)', icon: '📊' },\r
  { id: 'learnedindex', label: 'Learned index', icon: '📈' },\r
  { id: 'heap', label: 'Binary heap', icon: '⛰️' },\r
  { id: 'pairingheap', label: 'Pairing heap (mergeable)', icon: '🫱' },\r
  { id: 'segtree', label: 'Segment tree', icon: '🌲' },\r
  { id: 'intervaltree', label: 'Interval tree', icon: '📊' },\r
  { id: 'avl', label: 'AVL tree', icon: '🌳' },\r
  { id: 'splaytree', label: 'Splay tree', icon: '🔃' },\r
  { id: 'treap', label: 'Treap (randomized BST)', icon: '🎲' },\r
  { id: 'piecetable', label: 'Piece table (text editor)', icon: '📝' },\r
  { id: 'rope', label: 'Rope (text editor tree)', icon: '🪢' },\r
  { id: 'gapbuffer', label: 'Gap buffer (Emacs)', icon: '⌨️' },\r
  { id: 'timsort', label: 'The sort in your standard library (Timsort)', icon: '🎬' },\r
  { id: 'sorting', label: 'Sorting algorithms', icon: '📊' },\r
  { id: 'kadane', label: 'Kadane (max subarray)', icon: '📈' },\r
  { id: 'lis', label: 'Longest increasing subseq', icon: '📶' },\r
  { id: 'quickselect', label: 'Quickselect (k-th)', icon: '🎯' },\r
  { id: 'medianofmedians', label: 'Median of medians', icon: '🎯' },\r
  { id: 'dnf', label: 'Dutch national flag', icon: '🇳🇱' },\r
  { id: 'shuffle', label: 'Shuffle bias (Fisher–Yates)', icon: '🔀' },\r
  { id: 'aliasmethod', label: 'Alias method (weighted sampling)', icon: '🎰' },\r
  { id: 'montecarlo', label: 'Estimating π by throwing darts (Monte Carlo)', icon: '🎬' },\r
  { id: 'ransac', label: 'Fitting a line through 50% outliers (RANSAC)', icon: '🎬' },\r
  { id: 'kmp', label: 'KMP string search', icon: '🔎' },\r
  { id: 'editdist', label: 'Edit distance', icon: '📝' },\r
  { id: 'diff', label: 'How diff works (git diff, code review)', icon: '🎬' },\r
  { id: 'bktree', label: 'How fuzzy search finds typos (BK-tree)', icon: '🎬' },\r
  { id: 'knapsack', label: '0/1 Knapsack (DP)', icon: '🎒' },\r
  { id: 'toposort', label: 'Topological sort', icon: '🔢' },\r
  { id: 'astar', label: 'A* pathfinding', icon: '🧭' },\r
  { id: 'dpll', label: 'How a SAT solver works (DPLL)', icon: '🎬' },\r
  { id: 'maxflow', label: 'Max-flow / min-cut', icon: '🌊' },\r
  { id: 'mst', label: 'Minimum spanning tree', icon: '🌲' },\r
  { id: 'scc', label: 'Strongly connected comps', icon: '🔗' },\r
  { id: 'twosat', label: '2-SAT (implication graph)', icon: '🔀' },\r
  { id: 'cycledetect', label: 'Cycle detection (tortoise & hare)', icon: '🐢' },\r
  { id: 'floyd', label: 'Floyd-Warshall (all-pairs)', icon: '🔲' },\r
  { id: 'bellmanford', label: 'Bellman-Ford & arbitrage', icon: '💱' },\r
  { id: 'pagerank', label: 'How Google first ranked the web (PageRank)', icon: '🎬' },\r
  { id: 'kmeans', label: 'How k-means finds clusters (unsupervised)', icon: '🎬' },\r
  { id: 'dbscan', label: 'Clustering any shape + finding outliers (DBSCAN)', icon: '🎬' },\r
  { id: 'gmm', label: 'Soft clustering with Gaussians (GMM / EM)', icon: '🎬' },\r
  { id: 'pca', label: 'How PCA compresses data (principal components)', icon: '🎬' },\r
  { id: 'svd', label: 'How SVD compresses an image (low rank)', icon: '🎬' },\r
  { id: 'perceptron', label: 'The first neural net (perceptron & XOR)', icon: '🎬' },\r
  { id: 'logisticregression', label: 'From a hard line to a probability (logistic regression)', icon: '🎬' },\r
  { id: 'svm', label: 'The widest street between classes (SVM)', icon: '🎬' },\r
  { id: 'decisiontree', label: 'How a decision tree splits data (Gini)', icon: '🎬' },\r
  { id: 'randomforest', label: 'Why a forest beats one tree (bagging)', icon: '🎬' },\r
  { id: 'gradientboosting', label: 'Learning from residuals (gradient boosting)', icon: '🎬' },\r
  { id: 'newton', label: "Newton's method", icon: '➗' },\r
  { id: 'conjgrad', label: 'How conjugate gradient beats zigzag descent', icon: '🎬' },\r
  { id: 'simplex', label: 'How linear programming finds the best plan (simplex)', icon: '🎬' },\r
  { id: 'fft', label: 'Fast Fourier Transform', icon: '〰️' },\r
  { id: 'fmsynth', label: 'Two oscillators, a thousand timbres (FM synthesis)', icon: '🎬' },\r
  { id: 'haarwavelet', label: 'Multi-resolution & compression (Haar wavelet)', icon: '🎬' },\r
  { id: 'goertzel', label: 'How a phone hears touch-tones (Goertzel)', icon: '🎬' },\r
  { id: 'pitch', label: 'How a tuner hears pitch (autocorrelation)', icon: '🎬' },\r
  { id: 'karplus', label: 'How to synthesize a plucked string (Karplus-Strong)', icon: '🎬' },\r
  { id: 'adsr', label: 'The shape of every note (ADSR envelope)', icon: '🎬' },\r
  { id: 'convreverb', label: 'How reverb puts you in a cathedral (convolution)', icon: '🎬' },\r
  { id: 'biquad', label: 'The filter inside every EQ (biquad)', icon: '🎬' },\r
  { id: 'fastinvsqrt', label: 'Fast inverse square root', icon: '⚡' },\r
  { id: 'kahan', label: 'Kahan summation', icon: '➕' },\r
  { id: 'cordic', label: 'How calculators do trig (CORDIC)', icon: '🎬' },\r
  { id: 'karatsuba', label: 'Karatsuba multiplication', icon: '✖️' },\r
  { id: 'simanneal', label: 'Simulated annealing', icon: '🌡️' },\r
  { id: 'alphabeta', label: 'How game AI searches (alpha-beta)', icon: '🎬' },\r
  { id: 'backprop', label: 'How a neural network learns (backprop)', icon: '🎬' },\r
  { id: 'word2vec', label: 'How word embeddings work (word2vec)', icon: '🎬' },\r
  { id: 'vectorsearch', label: 'How vector search finds nearest embeddings (HNSW)', icon: '🎬' },\r
  { id: 'attention', label: 'How attention works (transformers)', icon: '🎬' },\r
  { id: 'moe', label: 'Mixture of Experts (MoE)', icon: '🧠' },\r
  { id: 'specdecode', label: 'Speculative decoding', icon: '⚡' },\r
  { id: 'kvcache', label: 'KV cache & PagedAttention', icon: '📑' },\r
  { id: 'quantize', label: 'Weight quantization (int4/int8)', icon: '🔢' },\r
  { id: 'bresenham', label: 'Bresenham line drawing', icon: '📐' },\r
  { id: 'bezier', label: 'How curves are drawn (Bézier & de Casteljau)', icon: '🎬' },\r
  { id: 'raytracing', label: 'How ray tracing renders an image', icon: '🎬' },\r
  { id: 'rasterize', label: 'How a GPU rasterizes a triangle', icon: '🎬' },\r
  { id: 'perspective', label: 'How 3D becomes 2D (perspective & the texture warp)', icon: '🎬' },\r
  { id: 'msaa', label: 'How GPUs smooth jagged edges (MSAA)', icon: '🎬' },\r
  { id: 'verlet', label: 'How game physics simulates rope & cloth', icon: '🎬' },\r
  { id: 'barneshut', label: 'How galaxies simulate gravity fast (Barnes-Hut)', icon: '🎬' },\r
  { id: 'doublependulum', label: 'Why the weather is unpredictable (chaos)', icon: '🎬' },\r
  { id: 'orbit', label: 'Why simulated orbits drift (symplectic integrators)', icon: '🎬' },\r
  { id: 'raymarch', label: 'How ray-marching renders with math (SDF)', icon: '🎬' },\r
  { id: 'quaternion', label: 'How 3D rotation really works (quaternions & slerp)', icon: '🎬' },\r
  { id: 'convexhull', label: 'Convex hull', icon: '🔷' },\r
  { id: 'sat', label: 'How games detect collisions (SAT)', icon: '🎬' },\r
  { id: 'spatialhash', label: 'How games skip the n² collision test (spatial hash)', icon: '🎬' },\r
  { id: 'marchsquares', label: 'Marching squares', icon: '🗺️' },\r
  { id: 'voronoi', label: 'Voronoi diagram', icon: '🔺' },\r
  { id: 'delaunay', label: 'Delaunay triangulation', icon: '📐' },\r
  { id: 'wfc', label: 'Generating maps by constraints (wave function collapse)', icon: '🎬' },\r
  { id: 'perlin', label: 'Perlin noise', icon: '🏔️' },\r
  { id: 'poisson', label: 'Poisson-disk sampling', icon: '⚪' },\r
  { id: 'rabinkarp', label: 'Rabin-Karp', icon: '🎞️' },\r
  { id: 'ahocorasick', label: 'Aho-Corasick', icon: '🔱' },\r
  { id: 'boyermoore', label: 'Boyer-Moore search', icon: '🏃' },\r
  { id: 'suffixarray', label: 'Suffix array', icon: '🔡' },\r
  { id: 'manacher', label: 'Manacher (palindromes)', icon: '🔁' },\r
  { id: 'zalgo', label: 'Z-algorithm', icon: '📏' },\r
  { id: 'arp', label: 'ARP resolution', icon: '📇' },\r
  { id: 'tor', label: 'Tor / onion routing', icon: '🧅' },\r
  { id: 'bittorrent', label: 'BitTorrent / torrents', icon: '🧲' },\r
  { id: 'magnet', label: 'Magnet links / infohash', icon: '🔗' },\r
  { id: 'censorship', label: 'Censorship circumvention', icon: '🧱' },\r
  { id: 'ech', label: 'ECH (encrypted SNI)', icon: '🎭' },\r
  { id: 'onionservice', label: 'Onion services (.onion)', icon: '🕳️' },\r
  { id: 'mixnet', label: 'Mix networks (batching anonymity)', icon: '🎛️' },\r
  { id: 'trafficcorr', label: 'Traffic correlation attack', icon: '🎯' },\r
  { id: 'firewall', label: 'Firewall rules (iptables)', icon: '🔥' },\r
  { id: 'siem', label: 'SIEM log correlation', icon: '🚨' },\r
  { id: 'seccomp', label: 'seccomp (syscall sandbox)', icon: '📦' },\r
  { id: 'capabilities', label: 'Linux capabilities', icon: '🔑' },\r
  { id: 'ebpf', label: 'eBPF & the verifier', icon: '🐝' },\r
  { id: 'honeypot', label: 'Honeypot & honeytokens', icon: '🍯' },\r
  { id: 'portknock', label: 'Port knocking', icon: '🚪' },\r
  { id: 'stptree', label: 'Spanning Tree', icon: '🌳' },\r
  { id: 'slaac', label: 'IPv6 SLAAC', icon: '🆔' },\r
  { id: 'csma', label: 'WiFi CSMA/CA', icon: '📶' },\r
  { id: 'routing', label: 'Routing & paths', icon: '🧭' },\r
  { id: 'lpm', label: 'How a router forwards (longest-prefix)', icon: '🎬' },\r
  { id: 'distvec', label: 'Distance-vector', icon: '📐' },\r
  { id: 'ospf', label: 'OSPF link-state', icon: '🗺️' },\r
  { id: 'bgp', label: 'BGP best-path', icon: '🥇' },\r
  { id: 'bgphijack', label: 'BGP hijack', icon: '🏴‍☠️' },\r
  { id: 'rpki', label: 'RPKI (route origin validation)', icon: '🛂' },\r
  { id: 'bgprr', label: 'BGP route reflectors', icon: '🪞' },\r
  { id: 'routeflap', label: 'BGP route flap damping', icon: '📉' },\r
  { id: 'mpls', label: 'MPLS switching', icon: '🏷️' },\r
  { id: 'segrouting', label: 'Segment routing', icon: '🧵' },\r
  { id: 'vxlan', label: 'VXLAN overlay', icon: '🪆' },\r
  { id: 'vrrp', label: 'VRRP redundancy', icon: '🛟' },\r
  { id: 'ipsec', label: 'IPsec ESP (VPN)', icon: '🔐' },\r
  { id: 'wireguard', label: 'WireGuard (cryptokey routing)', icon: '🐉' },\r
  { id: 'ecmp', label: 'ECMP load spreading', icon: '🔱' },\r
  { id: 'dnssec', label: 'DNSSEC chain', icon: '🔏' },\r
  { id: 'kaminsky', label: 'DNS cache poisoning', icon: '☠️' },\r
  { id: 'dns', label: 'DNS journey', icon: '🔎' },\r
  { id: 'mdns', label: 'mDNS & DNS-SD', icon: '🖨️' },\r
  { id: 'encdns', label: 'Encrypted DNS', icon: '🕵️' },\r
  { id: 'tcphand', label: 'TCP handshake', icon: '🤝' },\r
  { id: 'timewait', label: 'TIME_WAIT & ports', icon: '⏱️' },\r
  { id: 'tfo', label: 'TCP Fast Open', icon: '⚡' },\r
  { id: 'zerortt', label: '0-RTT resumption & replay', icon: '⏩' },\r
  { id: 'congestion', label: 'TCP congestion', icon: '📈' },\r
  { id: 'cubic', label: 'TCP CUBIC', icon: '📈' },\r
  { id: 'bbr', label: 'TCP BBR', icon: '🌊' },\r
  { id: 'flow', label: 'Flow control', icon: '🪟' },\r
  { id: 'h2flow', label: 'H2/QUIC flow control', icon: '🚰' },\r
  { id: 'sack', label: 'TCP SACK', icon: '🎯' },\r
  { id: 'arq', label: 'ARQ (GBN vs SR)', icon: '🔁' },\r
  { id: 'rto', label: 'RTO & Karn', icon: '⏱️' },\r
  { id: 'bdp', label: 'Bandwidth-Delay Product', icon: '🪣' },\r
  { id: 'queueing', label: 'M/M/1 queueing', icon: '📉' },\r
  { id: 'bufferbloat', label: 'Bufferbloat', icon: '🚰' },\r
  { id: 'ecn', label: 'ECN marking', icon: '🚩' },\r
  { id: 'qos', label: 'QoS scheduling', icon: '🚦' },\r
  { id: 'http2', label: 'HTTP/2 multiplexing', icon: '🧵' },\r
  { id: 'quic', label: 'QUIC vs TCP', icon: '🚀' },\r
  { id: 'quicmig', label: 'QUIC connection migration', icon: '📶' },\r
  { id: 'http3', label: 'HTTP/3 & QPACK', icon: '🌐' },\r
  { id: 'websocket', label: 'WebSocket', icon: '🔌' },\r
  { id: 'realtime', label: 'Realtime: SSE vs WS', icon: '📡' },\r
  { id: 'grpc', label: 'gRPC & protobuf', icon: '📡' },\r
  { id: 'cdn', label: 'CDN & caching', icon: '⚡' },\r
  { id: 'swcache', label: 'Service Worker caching', icon: '📴' },\r
  { id: 'conditional', label: 'Conditional & range', icon: '🔖' },\r
  { id: 'ratelimit', label: 'Rate limiting', icon: '🪣' },\r
  { id: 'leakybucket', label: 'Leaky bucket', icon: '🚿' },\r
  { id: 'gcra', label: 'GCRA (virtual scheduling)', icon: '⏱️' },\r
  { id: 'retry', label: 'Retry & circuit breaker', icon: '🔁' },\r
  { id: 'crypto', label: 'Cryptography', icon: '🔒' },\r
  { id: 'classical', label: 'Classical ciphers', icon: '🏛️' },\r
  { id: 'otpad', label: 'One-time pad', icon: '🎲' },\r
  { id: 'ecbpenguin', label: 'ECB penguin / modes', icon: '🐧' },\r
  { id: 'aesround', label: 'AES internals', icon: '🧊' },\r
  { id: 'feistel', label: 'Feistel / DES', icon: '🔁' },\r
  { id: 'aead', label: 'CTR & AEAD', icon: '🔐' },\r
  { id: 'montgomery', label: 'Montgomery multiplication', icon: '✖️' },\r
  { id: 'rsa', label: 'RSA', icon: '🗝️' },\r
  { id: 'millerrabin', label: 'Is this number prime? (Miller–Rabin)', icon: '🎬' },\r
  { id: 'pollardrho', label: 'Finding a factor by accident (Pollard’s rho)', icon: '🎬' },\r
  { id: 'crt', label: 'One number, many remainders (Chinese Remainder Theorem)', icon: '🎬' },\r
  { id: 'xgcd', label: 'Dividing mod m (extended Euclid & the modular inverse)', icon: '🎬' },\r
  { id: 'pubkey', label: 'How public-key crypto works', icon: '🎬' },\r
  { id: 'ecc', label: 'Elliptic curves', icon: '➰' },\r
  { id: 'montladder', label: 'Exponentiation that doesn’t leak (Montgomery ladder)', icon: '🎬' },\r
  { id: 'ecdsa', label: 'ECDSA & nonce reuse', icon: '✍️' },\r
  { id: 'tonelli', label: 'Square roots mod a prime (Tonelli–Shanks)', icon: '🎬' },\r
  { id: 'eddsa', label: 'EdDSA (Ed25519)', icon: '🖋️' },\r
  { id: 'pedersen', label: 'Pedersen commitment', icon: '✉️' },\r
  { id: 'blindsig', label: 'Blind signatures', icon: '🙈' },\r
  { id: 'vrf', label: 'Verifiable random function', icon: '🎲' },\r
  { id: 'ot', label: 'Oblivious transfer', icon: '🤝' },\r
  { id: 'garbled', label: 'Compute on secrets (Yao garbled circuits)', icon: '🎬' },\r
  { id: 'oram', label: 'Hiding what you access (Path ORAM)', icon: '🎬' },\r
  { id: 'pir', label: 'Fetching a record privately (PIR)', icon: '🎬' },\r
  { id: 'paillier', label: 'Homomorphic (Paillier)', icon: '➕' },\r
  { id: 'elgamal', label: 'ElGamal encryption', icon: '🔐' },\r
  { id: 'schnorr', label: 'Zero-knowledge (Schnorr)', icon: '🕵️‍♂️' },\r
  { id: 'bls', label: 'One signature for a thousand signers (BLS aggregation)', icon: '🎬' },\r
  { id: 'sumcheck', label: 'Proving a huge sum cheaply (sumcheck)', icon: '🎬' },\r
  { id: 'vdf', label: 'A clock you can’t rush (verifiable delay function)', icon: '🎬' },\r
  { id: 'chacha', label: 'ChaCha20', icon: '🌀' },\r
  { id: 'poly1305', label: 'Poly1305 MAC', icon: '🏷️' },\r
  { id: 'consttime', label: 'Timing attacks', icon: '⏱️' },\r
  { id: 'hashint', label: 'SHA-256 internals', icon: '🧮' },\r
  { id: 'hashbreak', label: 'Broken hashes', icon: '💥' },\r
  { id: 'lenext', label: 'Length-extension attack', icon: '➕' },\r
  { id: 'hmac', label: 'HMAC', icon: '🔏' },\r
  { id: 'paddingoracle', label: 'Padding oracle attack', icon: '🔓' },\r
  { id: 'dhkex', label: 'Diffie–Hellman', icon: '🤝' },\r
  { id: 'bsgs', label: 'Cracking a discrete log (baby-step giant-step)', icon: '🎬' },\r
  { id: 'dhmitm', label: 'DH man-in-the-middle', icon: '🕴️' },\r
  { id: 'tlsdowngrade', label: 'TLS downgrade', icon: '⬇️' },\r
  { id: 'tlsflow', label: 'How HTTPS secures a connection', icon: '🎬' },\r
  { id: 'pwhash', label: 'Password hashing', icon: '🔑' },\r
  { id: 'pqc', label: 'Post-quantum (LWE)', icon: '🔮' },\r
  { id: 'lll', label: 'How LLL reduces a lattice (& breaks crypto)', icon: '🎬' },\r
  { id: 'ntt', label: 'NTT (Kyber engine)', icon: '🦋' },\r
  { id: 'bb84', label: 'Quantum key (BB84)', icon: '⚛️' },\r
  { id: 'certs', label: 'Certificates (PKI)', icon: '📜' },\r
  { id: 'kerberos', label: 'Kerberos', icon: '🎟️' },\r
  { id: 'revocation', label: 'Revocation & CT', icon: '🚫' },\r
  { id: 'certtrans', label: 'Certificate Transparency', icon: '🔎' },\r
  { id: 'sigstore', label: 'Sigstore (keyless signing)', icon: '🔏' },\r
  { id: 'attest', label: 'Remote attestation (TEE)', icon: '🔐' },\r
  { id: 'ssh', label: 'SSH transport', icon: '🖧' },\r
  { id: 'sshtunnel', label: 'SSH tunneling (-L/-R/-D)', icon: '🚇' },\r
  { id: 'identity', label: 'Identity & Auth', icon: '🪪' },\r
  { id: 'jwt', label: 'JWT & alg=none', icon: '🎫' },\r
  { id: 'cors', label: 'CORS / Same-Origin', icon: '🚧' },\r
  { id: 'mailauth', label: 'Email auth (SPF/DKIM)', icon: '📧' },\r
  { id: 'totp', label: 'How your 2FA code works (TOTP)', icon: '🎬' },\r
  { id: 'webauthn', label: 'Passkeys (WebAuthn)', icon: '🔑' },\r
  { id: 'cookies', label: 'Cookies & sessions', icon: '🍪' },\r
  { id: 'csp', label: 'Content-Security-Policy', icon: '🧱' },\r
  { id: 'webinject', label: 'Injection (SQLi/XSS)', icon: '💉' },\r
  { id: 'bufferoverflow', label: 'How a buffer overflow hijacks a program', icon: '🎬' },\r
  { id: 'nxbit', label: 'How NX / DEP stops your shellcode', icon: '🎬' },\r
  { id: 'rop', label: 'How ROP bypasses NX', icon: '🎬' },\r
  { id: 'aslr', label: 'How ASLR randomizes the addresses', icon: '🎬' },\r
  { id: 'stackcanary', label: 'How a stack canary catches the overflow', icon: '🎬' },\r
  { id: 'cfi', label: 'How CFI and shadow stacks kill ROP', icon: '🎬' },\r
  { id: 'smuggle', label: 'Request smuggling', icon: '📦' },\r
  { id: 'ssrf', label: 'SSRF', icon: '🎯' },\r
  { id: 'xxe', label: 'XXE (XML entities)', icon: '📄' },\r
  { id: 'dnsrebind', label: 'DNS rebinding', icon: '🔀' },\r
  { id: 'arpspoof', label: 'ARP spoofing (MITM)', icon: '🎭' },\r
  { id: 'csrf', label: 'CSRF & SameSite', icon: '🎭' },\r
  { id: 'ids', label: 'IDS / IPS detection', icon: '👁️' },\r
  { id: 'dnstunnel', label: 'DNS tunneling (C2/exfil)', icon: '📡' },\r
  { id: 'clickjack', label: 'Clickjacking', icon: '👆' },\r
  { id: 'hsts', label: 'HSTS & SSL stripping', icon: '🔒' },\r
  { id: 'openredirect', label: 'Open redirect', icon: '↪️' },\r
  { id: 'protopollute', label: 'Prototype pollution', icon: '🧬' },\r
  { id: 'hashflood', label: 'Hash flooding (DoS)', icon: '🌊' },\r
  { id: 'redos', label: 'ReDoS (regex DoS)', icon: '💣' },\r
  { id: 'subdomain', label: 'Subdomain takeover', icon: '🏴' },\r
  { id: 'siteisolation', label: 'Site isolation', icon: '🧱' },\r
  { id: 'sri', label: 'Subresource Integrity', icon: '🔗' },\r
  { id: 'attacks', label: 'Attacks', icon: '⚔️' },\r
  { id: 'shamir', label: 'Secret sharing', icon: '🧩' },\r
  { id: 'envelope', label: 'Envelope encryption (KMS)', icon: '✉️' },\r
  { id: 'feldman', label: 'Verifiable secret sharing', icon: '🧩' },\r
  { id: 'threshsig', label: 'Threshold signatures', icon: '✍️' },\r
  { id: 'pow', label: 'Proof of Work', icon: '⛏️' },\r
  { id: 'ratchet', label: 'Double Ratchet', icon: '🔗' },\r
  { id: 'mls', label: 'MLS / TreeKEM (group messaging)', icon: '🌳' },\r
  { id: 'x3dh', label: 'X3DH key agreement', icon: '🤝' },\r
  { id: 'hashchain', label: 'Hash chain', icon: '⛓️' },\r
  { id: 'merkle', label: 'Merkle tree', icon: '🌳' },\r
  { id: 'accumulator', label: 'A whole set in one number (RSA accumulator)', icon: '🎬' },\r
  { id: 'lamportsig', label: 'Lamport signatures', icon: '🔏' },\r
  { id: 'encoding', label: 'Encoding', icon: '🔤' },\r
  { id: 'float', label: 'How a computer stores a fraction (IEEE-754)', icon: '🎬' },\r
  { id: 'graycode', label: 'Why encoders use Gray code (one bit at a time)', icon: '🎬' },\r
  { id: 'varint', label: 'Varint & zigzag', icon: '📏' },\r
  { id: 'base58', label: 'Base58 & Base58Check', icon: '🅱️' },\r
  { id: 'linecode', label: 'Line coding', icon: '〰️' },\r
  { id: 'lz77', label: 'LZ77 compression', icon: '🪟' },\r
  { id: 'lzw', label: 'LZW compression', icon: '📖' },\r
  { id: 'bwt', label: 'Burrows-Wheeler', icon: '🔄' },\r
  { id: 'debruijn', label: 'How genomes are assembled (de Bruijn graphs)', icon: '🎬' },\r
  { id: 'mtf', label: 'Move-to-front', icon: '↩️' },\r
  { id: 'cdc', label: 'Content-defined chunking', icon: '✂️' },\r
  { id: 'rsync', label: 'rsync (delta sync)', icon: '🔃' },\r
  { id: 'dfa', label: 'Finite automata (DFA)', icon: '🔄' },\r
  { id: 'huffman', label: 'Huffman coding', icon: '🗜️' },\r
  { id: 'jpeg', label: 'How JPEG compresses an image', icon: '🎬' },\r
  { id: 'seamcarve', label: 'How content-aware resize works (seam carving)', icon: '🎬' },\r
  { id: 'interframe', label: 'How video inter-frame compression works', icon: '🎬' },\r
  { id: 'mp3', label: 'How MP3 shrinks audio (psychoacoustic masking)', icon: '🎬' },\r
  { id: 'dithering', label: 'How dithering fakes gray with black & white', icon: '🎬' },\r
  { id: 'gamma', label: 'Why 128 isn’t half-bright (gamma)', icon: '🎬' },\r
  { id: 'colorspace', label: 'Why RGB blends look muddy (OKLab)', icon: '🎬' },\r
  { id: 'hdr', label: 'How HDR fits the sun on your screen (tone-mapping)', icon: '🎬' },\r
  { id: 'golombrice', label: 'Golomb-Rice coding', icon: '📐' },\r
  { id: 'eliascode', label: 'Elias γ/δ coding', icon: '🔢' },\r
  { id: 'gorilla', label: 'Gorilla (time-series)', icon: '🦍' },\r
  { id: 'cobs', label: 'COBS (byte stuffing)', icon: '📦' },\r
  { id: 'arith', label: 'Arithmetic coding', icon: '🎯' },\r
  { id: 'viterbi', label: 'Viterbi / convolutional', icon: '🧬' },\r
  { id: 'hamming', label: 'Hamming(7,4) code', icon: '🩹' },\r
  { id: 'reedsolomon', label: 'Reed-Solomon', icon: '💿' },\r
  { id: 'crc32', label: 'CRC-32 walk', icon: '🔁' },\r
  { id: 'errors', label: 'Error control', icon: '🛡️' },\r
  { id: 'barcode', label: 'How a barcode works (UPC check digit)', icon: '🎬' },\r
  { id: 'qrcode', label: 'How a QR code is built (Reed-Solomon + masking)', icon: '🎬' },\r
  { id: 'chord', label: 'Chord DHT', icon: '💍' },\r
  { id: 'kademlia', label: 'Kademlia DHT (XOR)', icon: '🔀' },\r
  { id: 'chash', label: 'Consistent hashing', icon: '⭕' },\r
  { id: 'jumphash', label: 'Jump consistent hash', icon: '🦘' },\r
  { id: 'rendezvous', label: 'Rendezvous hashing (HRW)', icon: '🎯' },\r
  { id: 'lb', label: 'Load balancing', icon: '⚖️' },\r
  { id: 'hll', label: 'HyperLogLog', icon: '🔢' },\r
  { id: 'countmin', label: 'Count-Min Sketch', icon: '📊' },\r
  { id: 'diffpriv', label: 'Publishing data without leaking you (differential privacy)', icon: '🎬' },\r
  { id: 'minhash', label: 'MinHash (set similarity)', icon: '🧬' },\r
  { id: 'majority', label: 'Majority vote', icon: '🗳️' },\r
  { id: 'reservoir', label: 'Reservoir sampling', icon: '🪣' },\r
  { id: 'bloom', label: 'Bloom filter', icon: '🌸' },\r
  { id: 'chandy', label: 'Chandy-Lamport snapshot', icon: '📸' },\r
  { id: 'phiaccrual', label: 'Failure detectors (φ)', icon: '💓' },\r
  { id: 'taillatency', label: 'Tail latency (p99)', icon: '📉' },\r
  { id: 'hdrhist', label: 'HdrHistogram (percentiles)', icon: '📊' },\r
  { id: 'ddsketch', label: 'DDSketch (quantiles)', icon: '📶' },\r
  { id: 'watermark', label: 'Stream watermarks', icon: '🌊' },\r
  { id: 'swim', label: 'SWIM failure detection', icon: '💓' },\r
  { id: 'deployments', label: 'Deployment strategies', icon: '🚀' },\r
  { id: 'healthcheck', label: 'Liveness vs readiness', icon: '🩺' },\r
  { id: 'autoscale', label: 'Autoscaling (HPA)', icon: '📈' },\r
  { id: 'kubesched', label: 'Kubernetes pod scheduling', icon: '☸️' },\r
  { id: 'usl', label: 'Universal Scalability Law', icon: '📉' },\r
  { id: 'pid', label: 'PID controller', icon: '🎛️' },\r
  { id: 'kalman', label: 'How a Kalman filter tracks', icon: '🎬' },\r
  { id: 'slo', label: 'SLOs & error budgets', icon: '🎯' },\r
  { id: 'tracing', label: 'Distributed tracing', icon: '🔭' },\r
  { id: 'featureflags', label: 'Feature flags', icon: '🚩' },\r
  { id: 'gracefulshutdown', label: 'Graceful shutdown', icon: '🔌' },\r
  { id: 'idempotency', label: 'Idempotency keys', icon: '🔁' },\r
  { id: 'loadshed', label: 'Load shedding', icon: '🚰' },\r
  { id: 'bulkhead', label: 'Bulkhead isolation', icon: '🚢' },\r
  { id: 'chaos', label: 'Chaos engineering', icon: '🐵' },\r
  { id: 'singleflight', label: 'Request coalescing', icon: '🤝' },\r
  { id: 'lamport', label: 'Lamport clocks', icon: '⏱️' },\r
  { id: 'hlc', label: 'Hybrid Logical Clocks', icon: '🕓' },\r
  { id: 'truetime', label: 'TrueTime & commit-wait', icon: '🛰️' },\r
  { id: 'snowflake', label: 'Snowflake IDs', icon: '❄️' },\r
  { id: 'vclock', label: 'Vector clocks', icon: '🕰️' },\r
  { id: 'causalbcast', label: 'Causal broadcast', icon: '➰' },\r
  { id: 'crdt', label: 'CRDTs', icon: '🧬' },\r
  { id: 'optransform', label: 'Operational transform', icon: '✍️' },\r
  { id: 'gossip', label: 'Gossip spread', icon: '🗣️' },\r
  { id: 'antientropy', label: 'Read-repair & anti-entropy', icon: '🩹' },\r
  { id: 'readrepair', label: 'Read repair (fix-on-read)', icon: '🔧' },\r
  { id: 'hintedhandoff', label: 'Hinted handoff', icon: '📨' },\r
  { id: 'paxos', label: 'Paxos consensus', icon: '🏛️' },\r
  { id: 'bully', label: 'Leader election', icon: '👑' },\r
  { id: 'fencing', label: 'Fencing tokens', icon: '🚧' },\r
  { id: 'leases', label: 'Leases & clock skew', icon: '⏳' },\r
  { id: 'pbft', label: 'PBFT (Byzantine)', icon: '😈' },\r
  { id: 'raft', label: 'Raft election', icon: '👑' },\r
  { id: 'raftlog', label: 'Raft log replication', icon: '📜' },\r
  { id: 'consistency', label: 'Consistency models', icon: '⚖️' },\r
  { id: 'cap', label: 'CAP theorem', icon: '⚖️' },\r
  { id: 'quorum', label: 'Quorum (R+W>N)', icon: '🗳️' },\r
  { id: 'replication', label: 'Replication (WAL)', icon: '🗄️' },\r
  { id: 'chainrep', label: 'Chain replication', icon: '⛓️' },\r
  { id: 'twopc', label: 'Two-phase commit', icon: '🤝' },\r
  { id: 'threepc', label: 'Three-phase commit', icon: '🔀' },\r
  { id: 'saga', label: 'Saga pattern', icon: '🔄' },\r
  { id: 'cpusched', label: 'CPU scheduling', icon: '⏱️' },\r
  { id: 'pagewalk', label: 'Page-table walk', icon: '🗺️' },\r
  { id: 'memlayout', label: 'Process memory layout', icon: '🧱' },\r
  { id: 'pagefault', label: 'How a page fault brings in memory', icon: '🎬' },\r
  { id: 'inode', label: 'inode & indirect blocks', icon: '🗃️' },\r
  { id: 'overlayfs', label: 'OverlayFS (container layers)', icon: '🗂️' },\r
  { id: 'bridgenet', label: 'Container bridge networking', icon: '🌉' },\r
  { id: 'mesi', label: 'MESI cache coherence', icon: '🧠' },\r
  { id: 'falseshare', label: 'False sharing', icon: '🔀' },\r
  { id: 'tso', label: 'Memory consistency (TSO)', icon: '🧮' },\r
  { id: 'branchpredict', label: 'Branch prediction', icon: '🔮' },\r
  { id: 'strideprefetch', label: 'How the CPU prefetches memory (stride prefetcher)', icon: '🎬' },\r
  { id: 'branchless', label: 'Code with no branches (branchless / cmov)', icon: '🎬' },\r
  { id: 'oooexec', label: 'Out-of-order execution', icon: '🔀' },\r
  { id: 'spectre', label: 'Spectre (speculation)', icon: '👻' },\r
  { id: 'meltdown', label: 'How Meltdown reads kernel memory (transient execution)', icon: '🎬' },\r
  { id: 'rowhammer', label: 'How Rowhammer flips bits in DRAM (fault injection)', icon: '🎬' },\r
  { id: 'killchain', label: 'The kill chain & defense-in-depth (attacker’s lens)', icon: '🎬' },\r
  { id: 'cow', label: 'Copy-on-write fork', icon: '🐄' },\r
  { id: 'tlb', label: 'TLB (address cache)', icon: '🗂️' },\r
  { id: 'nestedpaging', label: 'How a VM translates memory (nested paging)', icon: '🎬' },\r
  { id: 'numa', label: 'NUMA & first-touch', icon: '🧮' },\r
  { id: 'buddyalloc', label: 'Buddy allocator', icon: '🧱' },\r
  { id: 'arena', label: 'One block, one pointer (arena allocator)', icon: '🎬' },\r
  { id: 'gc', label: 'How garbage collection works', icon: '🎬' },\r
  { id: 'cheney', label: 'How a copying collector compacts the heap (Cheney)', icon: '🎬' },\r
  { id: 'refcount', label: 'How reference counting frees memory', icon: '🎬' },\r
  { id: 'ownership', label: 'How Rust ownership prevents memory bugs', icon: '🎬' },\r
  { id: 'timingwheel', label: 'Timing wheel', icon: '🎡' },\r
  { id: 'epoll', label: 'epoll & C10k', icon: '📡' },\r
  { id: 'futex', label: 'futex (fast mutex)', icon: '🔓' },\r
  { id: 'syscall', label: 'How a syscall enters the kernel', icon: '🎬' },\r
  { id: 'container', label: 'How a container isolates a process', icon: '🎬' },\r
  { id: 'cgroups', label: 'cgroups (resource limits)', icon: '🎚️' },\r
  { id: 'breakpoint', label: 'How a debugger breakpoint works', icon: '🎬' },\r
  { id: 'rcu', label: 'RCU (read-copy-update)', icon: '📖' },\r
  { id: 'aba', label: 'ABA problem (lock-free)', icon: '🔁' },\r
  { id: 'seqlock', label: 'seqlock (torn reads)', icon: '🔢' },\r
  { id: 'iouring', label: 'io_uring (async I/O)', icon: '💍' },\r
  { id: 'bakery', label: 'Lamport bakery (mutex)', icon: '🎫' },\r
  { id: 'cfs', label: 'Linux CFS scheduler', icon: '⚖️' },\r
  { id: 'eevdf', label: 'How Linux schedules now (EEVDF)', icon: '🎬' },\r
  { id: 'priorityinv', label: 'Priority inversion', icon: '🔺' },\r
  { id: 'pipeline', label: 'Pipeline hazards', icon: '🚰' },\r
  { id: 'cpucycle', label: 'How a CPU runs an instruction', icon: '🎬' },\r
  { id: 'shuntingyard', label: 'How a calculator parses math (shunting-yard)', icon: '🎬' },\r
  { id: 'compiler', label: 'How code becomes machine code', icon: '🎬' },\r
  { id: 'ssa', label: 'The form every optimizer uses (SSA & phi nodes)', icon: '🎬' },\r
  { id: 'regalloc', label: 'How variables get registers (graph coloring)', icon: '🎬' },\r
  { id: 'peephole', label: 'The compiler’s last polish (peephole optimization)', icon: '🎬' },\r
  { id: 'hindley', label: 'How types are inferred with none written (Hindley-Milner)', icon: '🎬' },\r
  { id: 'bytecode', label: 'How a bytecode VM runs code', icon: '🎬' },\r
  { id: 'wasm', label: 'How WebAssembly sandboxes untrusted code', icon: '🎬' },\r
  { id: 'jit', label: 'How a JIT makes code fast', icon: '🎬' },\r
  { id: 'transistor', label: 'Transistors → logic gates', icon: '🔀' },\r
  { id: 'cpucache', label: 'CPU cache (sets & ways)', icon: '⚡' },\r
  { id: 'dram', label: 'How RAM works (DRAM)', icon: '🧠' },\r
  { id: 'memorystory', label: 'Memory, up close (guided tour)', icon: '🎬' },\r
  { id: 'adder', label: 'Binary adder (gates→math)', icon: '➕' },\r
  { id: 'latch', label: 'Flip-flop (how bits are stored)', icon: '💾' },\r
  { id: 'alu', label: 'ALU (the compute core)', icon: '🧮' },\r
  { id: 'wallace', label: 'How hardware multiplies fast (Wallace tree)', icon: '🎬' },\r
  { id: 'membus', label: 'Address decoding & buses', icon: '🚌' },\r
  { id: 'io', label: 'Polling · interrupts · DMA', icon: '🔔' },\r
  { id: 'keystroke', label: 'How a keystroke reaches the screen', icon: '🎬' },\r
  { id: 'ssd', label: 'How an SSD works (flash/FTL)', icon: '💽' },\r
  { id: 'flashcell', label: 'How flash stores a bit (floating gate)', icon: '🎬' },\r
  { id: 'gpu', label: 'GPU / SIMT execution', icon: '🎮' },\r
  { id: 'systolic', label: 'How a TPU multiplies matrices (systolic array)', icon: '🎬' },\r
];

// Keep the upstream identifiers stable while presenting the catalog in Chinese.
export const SECTION_META: SectionMeta[] = RAW_SECTION_META.map((item) => ({
  ...item,
  label: zhSection(item.id, item.label),
}));
\r
export const metaById: Record<string, SectionMeta> = Object.fromEntries(SECTION_META.map((m) => [m.id, m]));\r
\r
export interface SectionGroup { label: string; icon: string; ids: string[] }\r
\r
export const GROUPS: SectionGroup[] = [\r
  { label: '网络基础', icon: '🌐', ids: ['network', 'switch', 'stptree', 'arp', 'csma', 'dhcp', 'nat', 'natpunch', 'ttlhop', 'traceroute', 'subnet', 'fragment', 'pmtud', 'ipcompare', 'happyeyeballs', 'nagle', 'slaac', 'icmp', 'anycast', 'multicast', 'wpa', 'dot1x', 'vlan', 'ntp', 'gps'] },
  { label: '路由与命名', icon: '🧭', ids: ['routing', 'lpm', 'distvec', 'ospf', 'bgp', 'bgphijack', 'rpki', 'bgprr', 'routeflap', 'mpls', 'segrouting', 'vxlan', 'vrrp', 'ipsec', 'wireguard', 'ecmp', 'dns', 'dnssec', 'kaminsky', 'mdns', 'encdns'] },
  { label: '传输与网页', icon: '🚀', ids: ['tcphand', 'timewait', 'tfo', 'zerortt', 'congestion', 'cubic', 'bbr', 'flow', 'sws', 'sack', 'arq', 'rto', 'bdp', 'queueing', 'bufferbloat', 'ecn', 'qos', 'h2flow', 'http2', 'quic', 'quicmig', 'http3', 'grpc', 'websocket', 'realtime', 'sctp', 'mptcp', 'cdn', 'swcache', 'conditional', 'ratelimit', 'leakybucket', 'gcra', 'retry'] },
  { label: '密码学', icon: '🔒', ids: ['crypto', 'classical', 'otpad', 'aesround', 'ecbpenguin', 'feistel', 'aead', 'chacha', 'poly1305', 'consttime', 'hashint', 'hashbreak', 'lenext', 'hmac', 'paddingoracle', 'montgomery', 'pubkey', 'rsa', 'millerrabin', 'pollardrho', 'crt', 'xgcd', 'ecc', 'montladder', 'ecdsa', 'tonelli', 'eddsa', 'pedersen', 'blindsig', 'vrf', 'ot', 'garbled', 'oram', 'pir', 'paillier', 'elgamal', 'schnorr', 'bls', 'sumcheck', 'vdf', 'dhkex', 'bsgs', 'dhmitm', 'tlsdowngrade', 'tlsflow', 'pwhash', 'pqc', 'lll', 'ntt', 'bb84', 'shamir', 'envelope', 'feldman', 'threshsig', 'pow', 'ratchet', 'x3dh', 'mls', 'merkle', 'accumulator', 'lamportsig', 'hashchain'] },
  { label: '安全与网页', icon: '🛡️', ids: ['certs', 'kerberos', 'revocation', 'certtrans', 'sigstore', 'attest', 'ssh', 'sshtunnel', 'identity', 'jwt', 'mailauth', 'totp', 'webauthn', 'cookies', 'cors', 'webinject', 'bufferoverflow', 'nxbit', 'rop', 'aslr', 'stackcanary', 'cfi', 'smuggle', 'ssrf', 'xxe', 'dnsrebind', 'arpspoof', 'tor', 'censorship', 'ech', 'onionservice', 'mixnet', 'trafficcorr', 'firewall', 'siem', 'seccomp', 'capabilities', 'ebpf', 'honeypot', 'portknock', 'csrf', 'dnstunnel', 'ids', 'clickjack', 'hsts', 'openredirect', 'protopollute', 'hashflood', 'redos', 'subdomain', 'siteisolation', 'sri', 'csp', 'attacks'] },
  { label: '数据与编码', icon: '🔤', ids: ['encoding', 'float', 'graycode', 'varint', 'base58', 'linecode', 'lz77', 'lzw', 'bwt', 'debruijn', 'mtf', 'cdc', 'rsync', 'dfa', 'huffman', 'jpeg', 'seamcarve', 'interframe', 'mp3', 'dithering', 'gamma', 'colorspace', 'hdr', 'golombrice', 'eliascode', 'gorilla', 'cobs', 'arith', 'crc32', 'hamming', 'reedsolomon', 'viterbi', 'errors', 'barcode', 'qrcode'] },
  { label: '分布式系统', icon: '🕸️', ids: ['chash', 'jumphash', 'rendezvous', 'chord', 'kademlia', 'bittorrent', 'magnet', 'lb', 'hll', 'countmin', 'diffpriv', 'minhash', 'majority', 'reservoir', 'bloom', 'snowflake', 'lamport', 'chandy', 'phiaccrual', 'taillatency', 'hdrhist', 'ddsketch', 'watermark', 'swim', 'hlc', 'truetime', 'vclock', 'causalbcast', 'crdt', 'optransform', 'gossip', 'antientropy', 'readrepair', 'hintedhandoff', 'paxos', 'bully', 'fencing', 'leases', 'pbft', 'raft', 'raftlog', 'consistency', 'cap', 'quorum', 'replication', 'chainrep', 'twopc', 'threepc', 'saga'] },
  { label: '运维与可靠性', icon: '🛠️', ids: ['deployments', 'healthcheck', 'autoscale', 'kubesched', 'usl', 'pid', 'kalman', 'slo', 'tracing', 'featureflags', 'gracefulshutdown', 'idempotency', 'loadshed', 'bulkhead', 'chaos', 'singleflight'] },
  { label: '存储与数据库', icon: '🗄️', ids: ['btree', 'exthash', 'gitobjects', 'lsm', 'pagereplace', 'mvcc', 'wal', 'skiplist', 'locking', 'serializable', 'joins', 'gracejoin', 'queryplan', 'rum', 'trie', 'hamt', 'hashtable', 'cuckoo', 'cuckoofilter', 'robinhood', 'geohash', 'kdtree', 'unionfind', 'fenwick', 'sparsetable', 'cartesian', 'roaring', 'bitmapindex', 'columnar', 'learnedindex', 'heap', 'pairingheap', 'segtree', 'intervaltree', 'avl', 'splaytree', 'treap', 'piecetable', 'rope', 'gapbuffer', 'timsort', 'sorting', 'kadane', 'lis', 'quickselect', 'medianofmedians', 'dnf', 'shuffle', 'aliasmethod', 'montecarlo', 'ransac', 'kmp', 'rabinkarp', 'ahocorasick', 'boyermoore', 'suffixarray', 'manacher', 'zalgo', 'editdist', 'diff', 'bktree', 'knapsack', 'toposort', 'astar', 'dpll', 'maxflow', 'mst', 'scc', 'twosat', 'floyd', 'cycledetect', 'bellmanford', 'pagerank', 'kmeans', 'dbscan', 'gmm', 'pca', 'svd', 'perceptron', 'logisticregression', 'svm', 'decisiontree', 'randomforest', 'gradientboosting', 'newton', 'conjgrad', 'simplex', 'fft', 'fmsynth', 'haarwavelet', 'goertzel', 'pitch', 'karplus', 'adsr', 'convreverb', 'biquad', 'fastinvsqrt', 'kahan', 'cordic', 'karatsuba', 'simanneal', 'alphabeta', 'backprop', 'word2vec', 'vectorsearch', 'attention', 'moe', 'specdecode', 'kvcache', 'quantize', 'bresenham', 'bezier', 'raytracing', 'rasterize', 'perspective', 'msaa', 'verlet', 'barneshut', 'doublependulum', 'orbit', 'raymarch', 'quaternion', 'convexhull', 'sat', 'spatialhash', 'marchsquares', 'voronoi', 'delaunay', 'wfc', 'perlin', 'poisson'] },
  { label: '系统与操作系统', icon: '🖥️', ids: ['cpusched', 'cfs', 'eevdf', 'priorityinv', 'cpucycle', 'shuntingyard', 'compiler', 'ssa', 'regalloc', 'peephole', 'hindley', 'bytecode', 'wasm', 'jit', 'pipeline', 'branchpredict', 'strideprefetch', 'branchless', 'oooexec', 'spectre', 'meltdown', 'rowhammer', 'killchain', 'cow', 'pagewalk', 'memlayout', 'pagefault', 'inode', 'tlb', 'nestedpaging', 'numa', 'buddyalloc', 'arena', 'gc', 'cheney', 'refcount', 'ownership', 'timingwheel', 'epoll', 'syscall', 'container', 'cgroups', 'overlayfs', 'bridgenet', 'breakpoint', 'futex', 'rcu', 'aba', 'seqlock', 'iouring', 'bakery', 'mesi', 'falseshare', 'tso'] },
  { label: '硬件', icon: '🔌', ids: ['transistor', 'adder', 'latch', 'alu', 'wallace', 'membus', 'cpucache', 'dram', 'memorystory', 'io', 'keystroke', 'ssd', 'flashcell', 'gpu', 'systolic'] },
  { label: '自由实验', icon: '🛝', ids: ['playground'] },
];\r
\r
/** The label of the group that contains \`id\` (or null if ungrouped). */\r
export function groupOf(id: string): string | null {\r
  return GROUPS.find((g) => g.ids.includes(id))?.label ?? null;\r
}\r
`;export{e as default};