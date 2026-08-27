var e=`// Multi-language code examples, part 2 — see langSamples.ts. Split out only to keep either file under the 800-line\r
// review limit; the two are merged in langSamples.ts. Every snippet is verified by scripts/verify-code-examples.mjs.\r
import type { ExampleSet } from './langSampleTypes';\r
\r
export const EXTRA_EXAMPLES: Record<string, ExampleSet> = {\r
  sorting: {\r
    intro: 'Quicksort — partition around a pivot, recurse on each side. Sorting [5,2,9,1,5,6,3] gives 1 2 3 5 5 6 9. (C uses in-place Lomuto partitioning; C++ uses the standard library sort.)',\r
    expect: '1 2 3 5 5 6 9',\r
    snippets: [\r
      { lang: 'python', code: \`def quicksort(a):\r
    if len(a) <= 1:\r
        return a\r
    pivot = a[len(a) // 2]\r
    less = [x for x in a if x < pivot]\r
    equal = [x for x in a if x == pivot]\r
    greater = [x for x in a if x > pivot]\r
    return quicksort(less) + equal + quicksort(greater)\r
\r
print(" ".join(map(str, quicksort([5, 2, 9, 1, 5, 6, 3]))))\` },\r
      { lang: 'go', code: \`package main\r
\r
import (\r
	"fmt"\r
	"strconv"\r
	"strings"\r
)\r
\r
func quicksort(a []int) []int {\r
	if len(a) <= 1 {\r
		return a\r
	}\r
	pivot := a[len(a)/2]\r
	var less, equal, greater []int\r
	for _, x := range a {\r
		switch {\r
		case x < pivot:\r
			less = append(less, x)\r
		case x == pivot:\r
			equal = append(equal, x)\r
		default:\r
			greater = append(greater, x)\r
		}\r
	}\r
	out := append(quicksort(less), equal...)\r
	return append(out, quicksort(greater)...)\r
}\r
\r
func main() {\r
	a := quicksort([]int{5, 2, 9, 1, 5, 6, 3})\r
	s := make([]string, len(a))\r
	for i, x := range a {\r
		s[i] = strconv.Itoa(x)\r
	}\r
	fmt.Println(strings.Join(s, " "))\r
}\` },\r
      { lang: 'rust', code: \`fn quicksort(a: Vec<i64>) -> Vec<i64> {\r
    if a.len() <= 1 {\r
        return a;\r
    }\r
    let pivot = a[a.len() / 2];\r
    let less: Vec<i64> = a.iter().filter(|&&x| x < pivot).cloned().collect();\r
    let equal: Vec<i64> = a.iter().filter(|&&x| x == pivot).cloned().collect();\r
    let greater: Vec<i64> = a.iter().filter(|&&x| x > pivot).cloned().collect();\r
    let mut out = quicksort(less);\r
    out.extend(equal);\r
    out.extend(quicksort(greater));\r
    out\r
}\r
\r
fn main() {\r
    let sorted = quicksort(vec![5, 2, 9, 1, 5, 6, 3]);\r
    println!("{}", sorted.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(" "));\r
}\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
\r
void quicksort(int *a, int lo, int hi) {   // in-place Lomuto partition\r
    if (lo >= hi) return;\r
    int pivot = a[hi], i = lo;\r
    for (int j = lo; j < hi; j++)\r
        if (a[j] < pivot) { int t = a[i]; a[i] = a[j]; a[j] = t; i++; }\r
    int t = a[i]; a[i] = a[hi]; a[hi] = t;\r
    quicksort(a, lo, i - 1);\r
    quicksort(a, i + 1, hi);\r
}\r
\r
int main(void) {\r
    int a[] = {5, 2, 9, 1, 5, 6, 3}, n = 7;\r
    quicksort(a, 0, n - 1);\r
    for (int i = 0; i < n; i++) printf("%d%s", a[i], i + 1 < n ? " " : "\\\\n");\r
}\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <vector>\r
#include <algorithm>\r
\r
int main() {\r
    std::vector<int> a = {5, 2, 9, 1, 5, 6, 3};\r
    std::sort(a.begin(), a.end());\r
    for (size_t i = 0; i < a.size(); i++)\r
        std::cout << a[i] << (i + 1 < a.size() ? " " : "\\\\n");\r
}\` },\r
    ],\r
  },\r
\r
  quickselect: {\r
    intro: 'Quickselect — find the k-th smallest element without fully sorting, by partitioning and recursing into only the side that holds the answer (average O(n)). The 3rd smallest of [7,10,4,3,20,15] is 7.',\r
    expect: '7',\r
    snippets: [\r
      { lang: 'python', code: \`def quickselect(a, k):            # k-th smallest, 1-indexed\r
    a = a[:]\r
    lo, hi, target = 0, len(a) - 1, k - 1\r
    while True:\r
        pivot, i = a[hi], lo\r
        for j in range(lo, hi):\r
            if a[j] < pivot:\r
                a[i], a[j] = a[j], a[i]\r
                i += 1\r
        a[i], a[hi] = a[hi], a[i]\r
        if i == target:\r
            return a[i]\r
        if i < target:\r
            lo = i + 1\r
        else:\r
            hi = i - 1\r
\r
print(quickselect([7, 10, 4, 3, 20, 15], 3))\` },\r
      { lang: 'go', code: \`package main\r
\r
import "fmt"\r
\r
func quickselect(a []int, k int) int {\r
	a = append([]int(nil), a...)\r
	lo, hi, target := 0, len(a)-1, k-1\r
	for {\r
		pivot, i := a[hi], lo\r
		for j := lo; j < hi; j++ {\r
			if a[j] < pivot {\r
				a[i], a[j] = a[j], a[i]\r
				i++\r
			}\r
		}\r
		a[i], a[hi] = a[hi], a[i]\r
		if i == target {\r
			return a[i]\r
		}\r
		if i < target {\r
			lo = i + 1\r
		} else {\r
			hi = i - 1\r
		}\r
	}\r
}\r
\r
func main() { fmt.Println(quickselect([]int{7, 10, 4, 3, 20, 15}, 3)) }\` },\r
      { lang: 'rust', code: \`fn quickselect(a: &[i64], k: usize) -> i64 {\r
    let mut a = a.to_vec();\r
    let (mut lo, mut hi, target) = (0usize, a.len() - 1, k - 1);\r
    loop {\r
        let pivot = a[hi];\r
        let mut i = lo;\r
        for j in lo..hi {\r
            if a[j] < pivot {\r
                a.swap(i, j);\r
                i += 1;\r
            }\r
        }\r
        a.swap(i, hi);\r
        if i == target {\r
            return a[i];\r
        }\r
        if i < target {\r
            lo = i + 1;\r
        } else {\r
            hi = i - 1;\r
        }\r
    }\r
}\r
\r
fn main() { println!("{}", quickselect(&[7, 10, 4, 3, 20, 15], 3)); }\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
\r
int quickselect(int *a, int n, int k) {\r
    int lo = 0, hi = n - 1, target = k - 1;\r
    while (1) {\r
        int pivot = a[hi], i = lo;\r
        for (int j = lo; j < hi; j++)\r
            if (a[j] < pivot) { int t = a[i]; a[i] = a[j]; a[j] = t; i++; }\r
        int t = a[i]; a[i] = a[hi]; a[hi] = t;\r
        if (i == target) return a[i];\r
        if (i < target) lo = i + 1; else hi = i - 1;\r
    }\r
}\r
\r
int main(void) {\r
    int a[] = {7, 10, 4, 3, 20, 15};\r
    printf("%d\\\\n", quickselect(a, 6, 3));\r
}\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <vector>\r
\r
int quickselect(std::vector<int> a, int k) {\r
    int lo = 0, hi = a.size() - 1, target = k - 1;\r
    while (true) {\r
        int pivot = a[hi], i = lo;\r
        for (int j = lo; j < hi; j++)\r
            if (a[j] < pivot) std::swap(a[i++], a[j]);\r
        std::swap(a[i], a[hi]);\r
        if (i == target) return a[i];\r
        if (i < target) lo = i + 1; else hi = i - 1;\r
    }\r
}\r
\r
int main() { std::cout << quickselect({7, 10, 4, 3, 20, 15}, 3) << "\\\\n"; }\` },\r
    ],\r
  },\r
\r
  fenwick: {\r
    intro: 'Fenwick tree (binary indexed tree) — prefix sums with point updates, both in O(log n), using the low-bit trick i & (-i) to walk the implicit tree. Built from [3,2,-1,6,5,4,-3,3], the prefix sum of the first six is 3+2-1+6+5+4 = 19.',\r
    expect: '19',\r
    snippets: [\r
      { lang: 'python', code: \`def build(a):\r
    n = len(a)\r
    tree = [0] * (n + 1)\r
    for i, v in enumerate(a):\r
        j = i + 1\r
        while j <= n:\r
            tree[j] += v\r
            j += j & (-j)          # low bit: jump to the next range\r
    return tree\r
\r
def prefix_sum(tree, i):           # sum of a[0..i-1]\r
    s = 0\r
    while i > 0:\r
        s += tree[i]\r
        i -= i & (-i)\r
    return s\r
\r
tree = build([3, 2, -1, 6, 5, 4, -3, 3])\r
print(prefix_sum(tree, 6))\` },\r
      { lang: 'go', code: \`package main\r
\r
import "fmt"\r
\r
func build(a []int) []int {\r
	n := len(a)\r
	tree := make([]int, n+1)\r
	for i, v := range a {\r
		for j := i + 1; j <= n; j += j & (-j) {\r
			tree[j] += v\r
		}\r
	}\r
	return tree\r
}\r
\r
func prefixSum(tree []int, i int) int {\r
	s := 0\r
	for ; i > 0; i -= i & (-i) {\r
		s += tree[i]\r
	}\r
	return s\r
}\r
\r
func main() {\r
	fmt.Println(prefixSum(build([]int{3, 2, -1, 6, 5, 4, -3, 3}), 6))\r
}\` },\r
      { lang: 'rust', code: \`fn build(a: &[i64]) -> Vec<i64> {\r
    let n = a.len();\r
    let mut tree = vec![0i64; n + 1];\r
    for (i, &v) in a.iter().enumerate() {\r
        let mut j = i + 1;\r
        while j <= n {\r
            tree[j] += v;\r
            j += j & j.wrapping_neg(); // low bit\r
        }\r
    }\r
    tree\r
}\r
\r
fn prefix_sum(tree: &[i64], mut i: usize) -> i64 {\r
    let mut s = 0;\r
    while i > 0 {\r
        s += tree[i];\r
        i -= i & i.wrapping_neg();\r
    }\r
    s\r
}\r
\r
fn main() {\r
    let tree = build(&[3, 2, -1, 6, 5, 4, -3, 3]);\r
    println!("{}", prefix_sum(&tree, 6));\r
}\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
\r
int tree[9];\r
\r
int main(void) {\r
    int a[] = {3, 2, -1, 6, 5, 4, -3, 3}, n = 8;\r
    for (int i = 0; i < n; i++)\r
        for (int j = i + 1; j <= n; j += j & (-j)) tree[j] += a[i];\r
    int s = 0;\r
    for (int i = 6; i > 0; i -= i & (-i)) s += tree[i];\r
    printf("%d\\\\n", s);\r
}\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <vector>\r
\r
int main() {\r
    std::vector<int> a = {3, 2, -1, 6, 5, 4, -3, 3};\r
    int n = a.size();\r
    std::vector<int> tree(n + 1, 0);\r
    for (int i = 0; i < n; i++)\r
        for (int j = i + 1; j <= n; j += j & (-j)) tree[j] += a[i];\r
    int s = 0;\r
    for (int i = 6; i > 0; i -= i & (-i)) s += tree[i];\r
    std::cout << s << "\\\\n";\r
}\` },\r
    ],\r
  },\r
\r
  crc32: {\r
    intro: 'CRC-32 (IEEE 802.3) — the checksum in Ethernet, zip, and PNG, computed bit by bit with the reflected polynomial 0xEDB88320. The check value for the ASCII string "123456789" is cbf43926 — the standard test vector every CRC-32 implementation must reproduce.',\r
    expect: 'cbf43926',\r
    snippets: [\r
      { lang: 'python', code: \`def crc32(data):\r
    crc = 0xFFFFFFFF\r
    for byte in data:\r
        crc ^= byte\r
        for _ in range(8):\r
            crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1))\r
    return crc ^ 0xFFFFFFFF\r
\r
print(format(crc32(b"123456789"), "08x"))\` },\r
      { lang: 'go', code: \`package main\r
\r
import "fmt"\r
\r
func crc32(data []byte) uint32 {\r
	crc := uint32(0xFFFFFFFF)\r
	for _, b := range data {\r
		crc ^= uint32(b)\r
		for i := 0; i < 8; i++ {\r
			crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1))\r
		}\r
	}\r
	return crc ^ 0xFFFFFFFF\r
}\r
\r
func main() { fmt.Printf("%08x\\\\n", crc32([]byte("123456789"))) }\` },\r
      { lang: 'rust', code: \`fn crc32(data: &[u8]) -> u32 {\r
    let mut crc: u32 = 0xFFFFFFFF;\r
    for &b in data {\r
        crc ^= b as u32;\r
        for _ in 0..8 {\r
            crc = (crc >> 1) ^ (0xEDB88320 & (crc & 1).wrapping_neg());\r
        }\r
    }\r
    crc ^ 0xFFFFFFFF\r
}\r
\r
fn main() { println!("{:08x}", crc32(b"123456789")); }\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
#include <stdint.h>\r
#include <string.h>\r
\r
uint32_t crc32(const uint8_t *data, size_t len) {\r
    uint32_t crc = 0xFFFFFFFF;\r
    for (size_t k = 0; k < len; k++) {\r
        crc ^= data[k];\r
        for (int i = 0; i < 8; i++)\r
            crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1));\r
    }\r
    return crc ^ 0xFFFFFFFF;\r
}\r
\r
int main(void) {\r
    const char *s = "123456789";\r
    printf("%08x\\\\n", crc32((const uint8_t *)s, strlen(s)));\r
}\` },\r
      { lang: 'cpp', code: \`#include <cstdio>\r
#include <cstdint>\r
#include <string>\r
\r
uint32_t crc32(const std::string& data) {\r
    uint32_t crc = 0xFFFFFFFF;\r
    for (unsigned char b : data) {\r
        crc ^= b;\r
        for (int i = 0; i < 8; i++)\r
            crc = (crc >> 1) ^ (0xEDB88320 & -(crc & 1));\r
    }\r
    return crc ^ 0xFFFFFFFF;\r
}\r
\r
int main() { printf("%08x\\\\n", crc32("123456789")); }\` },\r
    ],\r
  },\r
\r
  heap: {\r
    intro: 'Heapsort — build a binary max-heap in place, then repeatedly swap the largest to the end and sift the root down. O(n log n), no extra memory. [5,2,9,1,5,6,3] sorts to 1 2 3 5 5 6 9.',\r
    expect: '1 2 3 5 5 6 9',\r
    snippets: [\r
      { lang: 'python', code: \`def heapsort(a):\r
    n = len(a)\r
    def sift_down(start, end):\r
        root = start\r
        while 2*root + 1 <= end:\r
            child = 2*root + 1\r
            if child + 1 <= end and a[child] < a[child+1]:\r
                child += 1\r
            if a[root] < a[child]:\r
                a[root], a[child] = a[child], a[root]\r
                root = child\r
            else:\r
                return\r
    for start in range(n//2 - 1, -1, -1):   # build the heap\r
        sift_down(start, n-1)\r
    for end in range(n-1, 0, -1):           # repeatedly extract the max\r
        a[0], a[end] = a[end], a[0]\r
        sift_down(0, end-1)\r
    return a\r
\r
print(" ".join(map(str, heapsort([5, 2, 9, 1, 5, 6, 3]))))\` },\r
      { lang: 'go', code: \`package main\r
\r
import (\r
	"fmt"\r
	"strconv"\r
	"strings"\r
)\r
\r
func siftDown(a []int, start, end int) {\r
	root := start\r
	for 2*root+1 <= end {\r
		child := 2*root + 1\r
		if child+1 <= end && a[child] < a[child+1] {\r
			child++\r
		}\r
		if a[root] < a[child] {\r
			a[root], a[child] = a[child], a[root]\r
			root = child\r
		} else {\r
			return\r
		}\r
	}\r
}\r
\r
func heapsort(a []int) []int {\r
	n := len(a)\r
	for start := n/2 - 1; start >= 0; start-- {\r
		siftDown(a, start, n-1)\r
	}\r
	for end := n - 1; end > 0; end-- {\r
		a[0], a[end] = a[end], a[0]\r
		siftDown(a, 0, end-1)\r
	}\r
	return a\r
}\r
\r
func main() {\r
	a := heapsort([]int{5, 2, 9, 1, 5, 6, 3})\r
	s := make([]string, len(a))\r
	for i, x := range a {\r
		s[i] = strconv.Itoa(x)\r
	}\r
	fmt.Println(strings.Join(s, " "))\r
}\` },\r
      { lang: 'rust', code: \`fn sift_down(a: &mut Vec<i64>, start: usize, end: usize) {\r
    let mut root = start;\r
    while 2*root + 1 <= end {\r
        let mut child = 2*root + 1;\r
        if child + 1 <= end && a[child] < a[child+1] { child += 1; }\r
        if a[root] < a[child] { a.swap(root, child); root = child; } else { return; }\r
    }\r
}\r
\r
fn heapsort(mut a: Vec<i64>) -> Vec<i64> {\r
    let n = a.len();\r
    for start in (0..n/2).rev() { sift_down(&mut a, start, n-1); }\r
    for end in (1..n).rev() { a.swap(0, end); sift_down(&mut a, 0, end-1); }\r
    a\r
}\r
\r
fn main() {\r
    let sorted = heapsort(vec![5, 2, 9, 1, 5, 6, 3]);\r
    println!("{}", sorted.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(" "));\r
}\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
\r
void sift_down(int *a, int start, int end) {\r
    int root = start;\r
    while (2*root + 1 <= end) {\r
        int child = 2*root + 1;\r
        if (child + 1 <= end && a[child] < a[child+1]) child++;\r
        if (a[root] < a[child]) { int t = a[root]; a[root] = a[child]; a[child] = t; root = child; }\r
        else return;\r
    }\r
}\r
\r
int main(void) {\r
    int a[] = {5, 2, 9, 1, 5, 6, 3}, n = 7;\r
    for (int start = n/2 - 1; start >= 0; start--) sift_down(a, start, n-1);\r
    for (int end = n-1; end > 0; end--) { int t = a[0]; a[0] = a[end]; a[end] = t; sift_down(a, 0, end-1); }\r
    for (int i = 0; i < n; i++) printf("%d%s", a[i], i+1 < n ? " " : "\\\\n");\r
}\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <vector>\r
\r
void sift_down(std::vector<int>& a, int start, int end) {\r
    int root = start;\r
    while (2*root + 1 <= end) {\r
        int child = 2*root + 1;\r
        if (child + 1 <= end && a[child] < a[child+1]) child++;\r
        if (a[root] < a[child]) { std::swap(a[root], a[child]); root = child; }\r
        else return;\r
    }\r
}\r
\r
int main() {\r
    std::vector<int> a = {5, 2, 9, 1, 5, 6, 3};\r
    int n = a.size();\r
    for (int start = n/2 - 1; start >= 0; start--) sift_down(a, start, n-1);\r
    for (int end = n-1; end > 0; end--) { std::swap(a[0], a[end]); sift_down(a, 0, end-1); }\r
    for (int i = 0; i < n; i++) std::cout << a[i] << (i+1 < n ? " " : "\\\\n");\r
}\` },\r
    ],\r
  },\r
\r
  bellmanford: {\r
    intro: 'Bellman-Ford — single-source shortest paths that, unlike Dijkstra, handles negative edge weights by relaxing every edge V-1 times. On the CLRS example graph (which has negative edges) the shortest distance from node 0 to node 3 is 4.',\r
    expect: '4',\r
    snippets: [\r
      { lang: 'python', code: \`def bellman_ford(n, edges, src, dst):\r
    INF = float("inf")\r
    dist = [INF] * n\r
    dist[src] = 0\r
    for _ in range(n - 1):                    # relax every edge V-1 times\r
        for u, v, w in edges:\r
            if dist[u] != INF and dist[u] + w < dist[v]:\r
                dist[v] = dist[u] + w\r
    return dist[dst]\r
\r
edges = [(0,1,6),(0,2,7),(1,2,8),(1,3,5),(1,4,-4),(2,3,-3),(2,4,9),(3,1,-2),(4,0,2),(4,3,7)]\r
print(bellman_ford(5, edges, 0, 3))\` },\r
      { lang: 'go', code: \`package main\r
\r
import "fmt"\r
\r
func bellmanFord(n int, edges [][3]int, src, dst int) int {\r
	const INF = 1 << 30\r
	dist := make([]int, n)\r
	for i := range dist {\r
		dist[i] = INF\r
	}\r
	dist[src] = 0\r
	for k := 0; k < n-1; k++ {\r
		for _, e := range edges {\r
			u, v, w := e[0], e[1], e[2]\r
			if dist[u] != INF && dist[u]+w < dist[v] {\r
				dist[v] = dist[u] + w\r
			}\r
		}\r
	}\r
	return dist[dst]\r
}\r
\r
func main() {\r
	edges := [][3]int{{0, 1, 6}, {0, 2, 7}, {1, 2, 8}, {1, 3, 5}, {1, 4, -4}, {2, 3, -3}, {2, 4, 9}, {3, 1, -2}, {4, 0, 2}, {4, 3, 7}}\r
	fmt.Println(bellmanFord(5, edges, 0, 3))\r
}\` },\r
      { lang: 'rust', code: \`fn bellman_ford(n: usize, edges: &[(usize, usize, i64)], src: usize, dst: usize) -> i64 {\r
    const INF: i64 = 1 << 30;\r
    let mut dist = vec![INF; n];\r
    dist[src] = 0;\r
    for _ in 0..n - 1 {\r
        for &(u, v, w) in edges {\r
            if dist[u] != INF && dist[u] + w < dist[v] {\r
                dist[v] = dist[u] + w;\r
            }\r
        }\r
    }\r
    dist[dst]\r
}\r
\r
fn main() {\r
    let edges = [(0,1,6),(0,2,7),(1,2,8),(1,3,5),(1,4,-4),(2,3,-3),(2,4,9),(3,1,-2),(4,0,2),(4,3,7)];\r
    println!("{}", bellman_ford(5, &edges, 0, 3));\r
}\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
#define INF (1 << 30)\r
\r
int main(void) {\r
    int edges[10][3] = {{0,1,6},{0,2,7},{1,2,8},{1,3,5},{1,4,-4},{2,3,-3},{2,4,9},{3,1,-2},{4,0,2},{4,3,7}};\r
    int n = 5, dist[5];\r
    for (int i = 0; i < n; i++) dist[i] = INF;\r
    dist[0] = 0;\r
    for (int k = 0; k < n - 1; k++)\r
        for (int e = 0; e < 10; e++) {\r
            int u = edges[e][0], v = edges[e][1], w = edges[e][2];\r
            if (dist[u] != INF && dist[u] + w < dist[v]) dist[v] = dist[u] + w;\r
        }\r
    printf("%d\\\\n", dist[3]);\r
}\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <vector>\r
#include <array>\r
\r
int main() {\r
    const int INF = 1 << 30;\r
    std::vector<std::array<int,3>> edges = {{0,1,6},{0,2,7},{1,2,8},{1,3,5},{1,4,-4},{2,3,-3},{2,4,9},{3,1,-2},{4,0,2},{4,3,7}};\r
    int n = 5;\r
    std::vector<int> dist(n, INF);\r
    dist[0] = 0;\r
    for (int k = 0; k < n - 1; k++)\r
        for (auto& e : edges)\r
            if (dist[e[0]] != INF && dist[e[0]] + e[2] < dist[e[1]]) dist[e[1]] = dist[e[0]] + e[2];\r
    std::cout << dist[3] << "\\\\n";\r
}\` },\r
    ],\r
  },\r
\r
  huffman: {\r
    intro: 'Huffman coding cost — repeatedly merge the two least-frequent nodes; each merge adds one bit to every symbol beneath it, so the running sum of merge weights is the total encoded size. For "abracadabra" (a:5 b:2 r:2 c:1 d:1) that total is 23 bits — an invariant even though the specific codes can differ.',\r
    expect: '23',\r
    snippets: [\r
      { lang: 'python', code: \`import heapq\r
\r
def huffman_bits(freqs):\r
    heap = list(freqs)\r
    heapq.heapify(heap)\r
    total = 0\r
    while len(heap) > 1:\r
        a = heapq.heappop(heap)\r
        b = heapq.heappop(heap)\r
        total += a + b            # this merge adds a bit to every symbol below it\r
        heapq.heappush(heap, a + b)\r
    return total\r
\r
print(huffman_bits([5, 2, 2, 1, 1]))   # letter counts of "abracadabra"\` },\r
      { lang: 'go', code: \`package main\r
\r
import (\r
	"container/heap"\r
	"fmt"\r
)\r
\r
type IntHeap []int\r
\r
func (h IntHeap) Len() int            { return len(h) }\r
func (h IntHeap) Less(i, j int) bool  { return h[i] < h[j] }\r
func (h IntHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }\r
func (h *IntHeap) Push(x any)         { *h = append(*h, x.(int)) }\r
func (h *IntHeap) Pop() any           { old := *h; n := len(old); x := old[n-1]; *h = old[:n-1]; return x }\r
\r
func huffmanBits(freqs []int) int {\r
	h := IntHeap(append([]int(nil), freqs...))\r
	heap.Init(&h)\r
	total := 0\r
	for h.Len() > 1 {\r
		a := heap.Pop(&h).(int)\r
		b := heap.Pop(&h).(int)\r
		total += a + b\r
		heap.Push(&h, a+b)\r
	}\r
	return total\r
}\r
\r
func main() { fmt.Println(huffmanBits([]int{5, 2, 2, 1, 1})) }\` },\r
      { lang: 'rust', code: \`use std::collections::BinaryHeap;\r
use std::cmp::Reverse;\r
\r
fn huffman_bits(freqs: &[i64]) -> i64 {\r
    let mut heap: BinaryHeap<Reverse<i64>> = freqs.iter().map(|&f| Reverse(f)).collect();\r
    let mut total = 0;\r
    while heap.len() > 1 {\r
        let Reverse(a) = heap.pop().unwrap();\r
        let Reverse(b) = heap.pop().unwrap();\r
        total += a + b;\r
        heap.push(Reverse(a + b));\r
    }\r
    total\r
}\r
\r
fn main() { println!("{}", huffman_bits(&[5, 2, 2, 1, 1])); }\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
\r
int extract_min(int *heap, int *size) {   // linear-scan min extraction\r
    int mi = 0;\r
    for (int i = 1; i < *size; i++) if (heap[i] < heap[mi]) mi = i;\r
    int v = heap[mi];\r
    heap[mi] = heap[--(*size)];\r
    return v;\r
}\r
\r
int main(void) {\r
    int heap[] = {5, 2, 2, 1, 1}, size = 5, total = 0;\r
    while (size > 1) {\r
        int a = extract_min(heap, &size);\r
        int b = extract_min(heap, &size);\r
        total += a + b;\r
        heap[size++] = a + b;\r
    }\r
    printf("%d\\\\n", total);\r
}\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <queue>\r
#include <vector>\r
\r
int huffman_bits(std::vector<int> freqs) {\r
    std::priority_queue<int, std::vector<int>, std::greater<int>> pq(freqs.begin(), freqs.end());\r
    int total = 0;\r
    while (pq.size() > 1) {\r
        int a = pq.top(); pq.pop();\r
        int b = pq.top(); pq.pop();\r
        total += a + b;\r
        pq.push(a + b);\r
    }\r
    return total;\r
}\r
\r
int main() { std::cout << huffman_bits({5, 2, 2, 1, 1}) << "\\\\n"; }\` },\r
    ],\r
  },\r
};\r
`;export{e as default};