var e=`// Multi-language code examples, part 3 — see langSamples.ts. Split out only to keep every data file under the 800-line\r
// review limit; all three are merged in langSamples.ts. Every snippet is verified by scripts/verify-code-examples.mjs.\r
import type { ExampleSet } from './langSampleTypes';\r
\r
export const EXTRA2_EXAMPLES: Record<string, ExampleSet> = {\r
  varint: {\r
    intro: 'LEB128 varint — the variable-length integer encoding used by Protocol Buffers and WebAssembly. Each byte carries 7 bits of the number, low group first, with the high bit set to mean "more bytes follow". 624485 encodes to three bytes: e5 8e 26.',\r
    expect: 'e5 8e 26',\r
    snippets: [\r
      { lang: 'python', code: \`def leb128(n):\r
    out = []\r
    while True:\r
        byte = n & 0x7F            # low 7 bits\r
        n >>= 7\r
        if n:\r
            out.append(byte | 0x80)  # more bytes follow\r
        else:\r
            out.append(byte)\r
            break\r
    return out\r
\r
print(" ".join(f"{b:02x}" for b in leb128(624485)))\` },\r
      { lang: 'go', code: \`package main\r
\r
import (\r
	"fmt"\r
	"strings"\r
)\r
\r
func leb128(n uint64) []byte {\r
	var out []byte\r
	for {\r
		b := byte(n & 0x7F)\r
		n >>= 7\r
		if n != 0 {\r
			out = append(out, b|0x80)\r
		} else {\r
			out = append(out, b)\r
			break\r
		}\r
	}\r
	return out\r
}\r
\r
func main() {\r
	var parts []string\r
	for _, b := range leb128(624485) {\r
		parts = append(parts, fmt.Sprintf("%02x", b))\r
	}\r
	fmt.Println(strings.Join(parts, " "))\r
}\` },\r
      { lang: 'rust', code: \`fn leb128(mut n: u64) -> Vec<u8> {\r
    let mut out = Vec::new();\r
    loop {\r
        let b = (n & 0x7F) as u8;\r
        n >>= 7;\r
        if n != 0 {\r
            out.push(b | 0x80); // more bytes follow\r
        } else {\r
            out.push(b);\r
            break;\r
        }\r
    }\r
    out\r
}\r
\r
fn main() {\r
    let hex: Vec<String> = leb128(624485).iter().map(|b| format!("{:02x}", b)).collect();\r
    println!("{}", hex.join(" "));\r
}\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
\r
int main(void) {\r
    unsigned long n = 624485;\r
    unsigned char out[10];\r
    int len = 0;\r
    while (1) {\r
        unsigned char b = n & 0x7F;\r
        n >>= 7;\r
        if (n) out[len++] = b | 0x80; else { out[len++] = b; break; }\r
    }\r
    for (int i = 0; i < len; i++) printf("%02x%s", out[i], i + 1 < len ? " " : "\\\\n");\r
}\` },\r
      { lang: 'cpp', code: \`#include <vector>\r
#include <cstdio>\r
\r
int main() {\r
    unsigned long n = 624485;\r
    std::vector<unsigned char> out;\r
    while (true) {\r
        unsigned char b = n & 0x7F;\r
        n >>= 7;\r
        if (n) out.push_back(b | 0x80); else { out.push_back(b); break; }\r
    }\r
    for (size_t i = 0; i < out.size(); i++) printf("%02x%s", out[i], i + 1 < out.size() ? " " : "\\\\n");\r
}\` },\r
    ],\r
  },\r
\r
  base58: {\r
    intro: 'Base58 — the text encoding behind Bitcoin addresses and IPFS CIDs, dropping the ambiguous 0/O/I/l. The bytes are one big base-256 number, repeatedly divided by 58 (done here as long division over a digit array, so no bignum library is needed); the 5 bytes of "Hello" encode to 9Ajdvzr.',\r
    expect: '9Ajdvzr',\r
    snippets: [\r
      { lang: 'python', code: \`ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"\r
\r
def base58(data):\r
    n = int.from_bytes(bytes(data), "big")\r
    out = ""\r
    while n > 0:\r
        n, r = divmod(n, 58)\r
        out = ALPHABET[r] + out\r
    for b in data:              # leading zero bytes become leading '1's\r
        if b == 0:\r
            out = "1" + out\r
        else:\r
            break\r
    return out\r
\r
print(base58([72, 101, 108, 108, 111]))   # "Hello"\` },\r
      { lang: 'go', code: \`package main\r
\r
import "fmt"\r
\r
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"\r
\r
func base58(data []byte) string {\r
	digits := []int{0}\r
	for _, b := range data { // long division: base-256 in, base-58 out\r
		carry := int(b)\r
		for j := range digits {\r
			carry += digits[j] << 8\r
			digits[j] = carry % 58\r
			carry /= 58\r
		}\r
		for carry > 0 {\r
			digits = append(digits, carry%58)\r
			carry /= 58\r
		}\r
	}\r
	out := ""\r
	for _, b := range data {\r
		if b == 0 {\r
			out += "1"\r
		} else {\r
			break\r
		}\r
	}\r
	for i := len(digits) - 1; i >= 0; i-- {\r
		out += string(alphabet[digits[i]])\r
	}\r
	return out\r
}\r
\r
func main() { fmt.Println(base58([]byte{72, 101, 108, 108, 111})) }\` },\r
      { lang: 'rust', code: \`const ALPHABET: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";\r
\r
fn base58(data: &[u8]) -> String {\r
    let mut digits = vec![0u32];\r
    for &b in data {\r
        let mut carry = b as u32;\r
        for d in digits.iter_mut() {\r
            carry += *d << 8;\r
            *d = carry % 58;\r
            carry /= 58;\r
        }\r
        while carry > 0 {\r
            digits.push(carry % 58);\r
            carry /= 58;\r
        }\r
    }\r
    let mut out = String::new();\r
    for &b in data {\r
        if b == 0 { out.push('1'); } else { break; }\r
    }\r
    for &d in digits.iter().rev() {\r
        out.push(ALPHABET[d as usize] as char);\r
    }\r
    out\r
}\r
\r
fn main() { println!("{}", base58(&[72, 101, 108, 108, 111])); }\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
\r
int main(void) {\r
    const char *alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";\r
    unsigned char data[] = {72, 101, 108, 108, 111};   // "Hello"\r
    int n = 5, digits[32], dlen = 1;\r
    digits[0] = 0;\r
    for (int i = 0; i < n; i++) {\r
        int carry = data[i];\r
        for (int j = 0; j < dlen; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry /= 58; }\r
        while (carry > 0) { digits[dlen++] = carry % 58; carry /= 58; }\r
    }\r
    for (int i = 0; i < n && data[i] == 0; i++) putchar('1');\r
    for (int i = dlen - 1; i >= 0; i--) putchar(alphabet[digits[i]]);\r
    putchar('\\\\n');\r
}\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <vector>\r
#include <string>\r
\r
int main() {\r
    const std::string alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";\r
    std::vector<unsigned char> data = {72, 101, 108, 108, 111};  // "Hello"\r
    std::vector<int> digits = {0};\r
    for (unsigned char b : data) {\r
        int carry = b;\r
        for (int& d : digits) { carry += d << 8; d = carry % 58; carry /= 58; }\r
        while (carry > 0) { digits.push_back(carry % 58); carry /= 58; }\r
    }\r
    std::string out;\r
    for (unsigned char b : data) { if (b == 0) out += '1'; else break; }\r
    for (auto it = digits.rbegin(); it != digits.rend(); ++it) out += alphabet[*it];\r
    std::cout << out << "\\\\n";\r
}\` },\r
    ],\r
  },\r
\r
  maxflow: {\r
    intro: 'Edmonds-Karp maximum flow — repeatedly find a shortest augmenting path (by BFS) in the residual graph and push as much flow as its tightest edge allows, until no path from source to sink remains. On the classic CLRS network the maximum flow from node 0 to node 5 is 23.',\r
    expect: '23',\r
    snippets: [\r
      { lang: 'python', code: \`from collections import deque\r
\r
def max_flow(cap, s, t):\r
    n = len(cap)\r
    flow = 0\r
    while True:\r
        parent = [-1] * n\r
        parent[s] = s\r
        q = deque([s])\r
        while q:                       # BFS for a shortest augmenting path\r
            u = q.popleft()\r
            for v in range(n):\r
                if parent[v] == -1 and cap[u][v] > 0:\r
                    parent[v] = u\r
                    q.append(v)\r
        if parent[t] == -1:\r
            break\r
        f, v = float("inf"), t\r
        while v != s:\r
            f = min(f, cap[parent[v]][v]); v = parent[v]\r
        v = t\r
        while v != s:\r
            cap[parent[v]][v] -= f; cap[v][parent[v]] += f; v = parent[v]\r
        flow += f\r
    return flow\r
\r
n = 6\r
cap = [[0] * n for _ in range(n)]\r
for u, v, c in [(0,1,16),(0,2,13),(1,3,12),(2,1,4),(2,4,14),(3,2,9),(3,5,20),(4,3,7),(4,5,4)]:\r
    cap[u][v] = c\r
print(max_flow(cap, 0, 5))\` },\r
      { lang: 'go', code: \`package main\r
\r
import "fmt"\r
\r
func maxFlow(cap [][]int, s, t int) int {\r
	n := len(cap)\r
	flow := 0\r
	for {\r
		parent := make([]int, n)\r
		for i := range parent {\r
			parent[i] = -1\r
		}\r
		parent[s] = s\r
		queue := []int{s}\r
		for len(queue) > 0 {\r
			u := queue[0]\r
			queue = queue[1:]\r
			for v := 0; v < n; v++ {\r
				if parent[v] == -1 && cap[u][v] > 0 {\r
					parent[v] = u\r
					queue = append(queue, v)\r
				}\r
			}\r
		}\r
		if parent[t] == -1 {\r
			break\r
		}\r
		f := 1 << 30\r
		for v := t; v != s; v = parent[v] {\r
			if cap[parent[v]][v] < f {\r
				f = cap[parent[v]][v]\r
			}\r
		}\r
		for v := t; v != s; v = parent[v] {\r
			cap[parent[v]][v] -= f\r
			cap[v][parent[v]] += f\r
		}\r
		flow += f\r
	}\r
	return flow\r
}\r
\r
func main() {\r
	n := 6\r
	cap := make([][]int, n)\r
	for i := range cap {\r
		cap[i] = make([]int, n)\r
	}\r
	edges := [][3]int{{0, 1, 16}, {0, 2, 13}, {1, 3, 12}, {2, 1, 4}, {2, 4, 14}, {3, 2, 9}, {3, 5, 20}, {4, 3, 7}, {4, 5, 4}}\r
	for _, e := range edges {\r
		cap[e[0]][e[1]] = e[2]\r
	}\r
	fmt.Println(maxFlow(cap, 0, 5))\r
}\` },\r
      { lang: 'rust', code: \`use std::collections::VecDeque;\r
\r
fn max_flow(cap: &mut Vec<Vec<i64>>, s: usize, t: usize) -> i64 {\r
    let n = cap.len();\r
    let mut flow = 0;\r
    loop {\r
        let mut parent = vec![usize::MAX; n];\r
        parent[s] = s;\r
        let mut q = VecDeque::from([s]);\r
        while let Some(u) = q.pop_front() {\r
            for v in 0..n {\r
                if parent[v] == usize::MAX && cap[u][v] > 0 {\r
                    parent[v] = u;\r
                    q.push_back(v);\r
                }\r
            }\r
        }\r
        if parent[t] == usize::MAX {\r
            break;\r
        }\r
        let (mut f, mut v) = (i64::MAX, t);\r
        while v != s {\r
            f = f.min(cap[parent[v]][v]);\r
            v = parent[v];\r
        }\r
        v = t;\r
        while v != s {\r
            cap[parent[v]][v] -= f;\r
            cap[v][parent[v]] += f;\r
            v = parent[v];\r
        }\r
        flow += f;\r
    }\r
    flow\r
}\r
\r
fn main() {\r
    let n = 6;\r
    let mut cap = vec![vec![0i64; n]; n];\r
    for &(u, v, c) in &[(0,1,16),(0,2,13),(1,3,12),(2,1,4),(2,4,14),(3,2,9),(3,5,20),(4,3,7),(4,5,4)] {\r
        cap[u][v] = c;\r
    }\r
    println!("{}", max_flow(&mut cap, 0, 5));\r
}\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
#define N 6\r
\r
int cap[N][N];\r
\r
int max_flow(int s, int t) {\r
    int flow = 0;\r
    while (1) {\r
        int parent[N], queue[N], head = 0, tail = 0;\r
        for (int i = 0; i < N; i++) parent[i] = -1;\r
        parent[s] = s; queue[tail++] = s;\r
        while (head < tail) {\r
            int u = queue[head++];\r
            for (int v = 0; v < N; v++)\r
                if (parent[v] == -1 && cap[u][v] > 0) { parent[v] = u; queue[tail++] = v; }\r
        }\r
        if (parent[t] == -1) break;\r
        int f = 1 << 30;\r
        for (int v = t; v != s; v = parent[v]) if (cap[parent[v]][v] < f) f = cap[parent[v]][v];\r
        for (int v = t; v != s; v = parent[v]) { cap[parent[v]][v] -= f; cap[v][parent[v]] += f; }\r
        flow += f;\r
    }\r
    return flow;\r
}\r
\r
int main(void) {\r
    int edges[9][3] = {{0,1,16},{0,2,13},{1,3,12},{2,1,4},{2,4,14},{3,2,9},{3,5,20},{4,3,7},{4,5,4}};\r
    for (int i = 0; i < 9; i++) cap[edges[i][0]][edges[i][1]] = edges[i][2];\r
    printf("%d\\\\n", max_flow(0, 5));\r
}\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <vector>\r
#include <queue>\r
#include <algorithm>\r
\r
int max_flow(std::vector<std::vector<int>>& cap, int s, int t) {\r
    int n = cap.size(), flow = 0;\r
    while (true) {\r
        std::vector<int> parent(n, -1);\r
        parent[s] = s;\r
        std::queue<int> q;\r
        q.push(s);\r
        while (!q.empty()) {\r
            int u = q.front(); q.pop();\r
            for (int v = 0; v < n; v++)\r
                if (parent[v] == -1 && cap[u][v] > 0) { parent[v] = u; q.push(v); }\r
        }\r
        if (parent[t] == -1) break;\r
        int f = 1 << 30;\r
        for (int v = t; v != s; v = parent[v]) f = std::min(f, cap[parent[v]][v]);\r
        for (int v = t; v != s; v = parent[v]) { cap[parent[v]][v] -= f; cap[v][parent[v]] += f; }\r
        flow += f;\r
    }\r
    return flow;\r
}\r
\r
int main() {\r
    int n = 6;\r
    std::vector<std::vector<int>> cap(n, std::vector<int>(n, 0));\r
    int edges[9][3] = {{0,1,16},{0,2,13},{1,3,12},{2,1,4},{2,4,14},{3,2,9},{3,5,20},{4,3,7},{4,5,4}};\r
    for (auto& e : edges) cap[e[0]][e[1]] = e[2];\r
    std::cout << max_flow(cap, 0, 5) << "\\\\n";\r
}\` },\r
    ],\r
  },\r
};\r
`;export{e as default};