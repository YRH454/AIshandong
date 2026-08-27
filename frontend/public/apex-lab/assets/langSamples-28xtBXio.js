var e=`// Multi-language reference implementations for a section's core idea, shown beside the tested TypeScript model. These\r
// are read-only examples (Apex stays a static, offline, no-backend page — it doesn't execute them). They are kept\r
// honest instead of plausible-looking: every snippet prints the same \`expect\` value, and scripts/verify-code-examples.mjs\r
// compiles and runs each one (Python/Go/Rust/C/C++) and asserts that output. Types live in langSampleTypes.ts; the\r
// overflow entries live in langSamplesExtra.ts so neither file exceeds the review size limit.\r
import { LANGS, type ExampleSet } from './langSampleTypes';\r
import { EXTRA_EXAMPLES } from './langSamplesExtra';\r
import { EXTRA2_EXAMPLES } from './langSamplesExtra2';\r
\r
export { LANGS };\r
export type { Lang, Snippet, ExampleSet } from './langSampleTypes';\r
\r
export const CODE_EXAMPLES: Record<string, ExampleSet> = {\r
\r
  kadane: {\r
    intro: 'Kadane’s algorithm — the maximum sum of any contiguous subarray, in one pass. On [-2,1,-3,4,-1,2,1,-5,4] the best run is [4,-1,2,1], summing to 6.',\r
    expect: '6',\r
    snippets: [\r
      { lang: 'python', code: \`def max_subarray(a):\r
    best = cur = a[0]\r
    for x in a[1:]:\r
        cur = max(x, cur + x)   # extend the run, or start fresh at x\r
        best = max(best, cur)\r
    return best\r
\r
print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))\` },\r
      { lang: 'go', code: \`package main\r
\r
import "fmt"\r
\r
func maxSubarray(a []int) int {\r
	best, cur := a[0], a[0]\r
	for _, x := range a[1:] {\r
		if cur+x < x {\r
			cur = x\r
		} else {\r
			cur += x\r
		}\r
		if cur > best {\r
			best = cur\r
		}\r
	}\r
	return best\r
}\r
\r
func main() {\r
	fmt.Println(maxSubarray([]int{-2, 1, -3, 4, -1, 2, 1, -5, 4}))\r
}\` },\r
      { lang: 'rust', code: \`fn max_subarray(a: &[i64]) -> i64 {\r
    let (mut best, mut cur) = (a[0], a[0]);\r
    for &x in &a[1..] {\r
        cur = x.max(cur + x); // extend the run, or start fresh at x\r
        best = best.max(cur);\r
    }\r
    best\r
}\r
\r
fn main() {\r
    println!("{}", max_subarray(&[-2, 1, -3, 4, -1, 2, 1, -5, 4]));\r
}\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
\r
long max_subarray(const long *a, int n) {\r
    long best = a[0], cur = a[0];\r
    for (int i = 1; i < n; i++) {\r
        cur = a[i] > cur + a[i] ? a[i] : cur + a[i];\r
        if (cur > best) best = cur;\r
    }\r
    return best;\r
}\r
\r
int main(void) {\r
    long a[] = {-2, 1, -3, 4, -1, 2, 1, -5, 4};\r
    printf("%ld\\\\n", max_subarray(a, 9));\r
}\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <vector>\r
#include <algorithm>\r
\r
long max_subarray(const std::vector<long>& a) {\r
    long best = a[0], cur = a[0];\r
    for (size_t i = 1; i < a.size(); i++) {\r
        cur = std::max(a[i], cur + a[i]);\r
        best = std::max(best, cur);\r
    }\r
    return best;\r
}\r
\r
int main() {\r
    std::cout << max_subarray({-2, 1, -3, 4, -1, 2, 1, -5, 4}) << "\\\\n";\r
}\` },\r
    ],\r
  },\r
  editdist: {\r
    intro: 'Levenshtein edit distance — the fewest single-character insertions, deletions, or substitutions to turn one string into another. "kitten" → "sitting" is 3 (substitute k→s, e→i, insert g).',\r
    expect: '3',\r
    snippets: [\r
      { lang: 'python', code: \`def edit_distance(a, b):\r
    m, n = len(a), len(b)\r
    dp = list(range(n + 1))          # one row of the DP table\r
    for i in range(1, m + 1):\r
        prev = dp[0]; dp[0] = i\r
        for j in range(1, n + 1):\r
            cur = dp[j]\r
            dp[j] = prev if a[i-1] == b[j-1] else 1 + min(dp[j], dp[j-1], prev)\r
            prev = cur\r
    return dp[n]\r
\r
print(edit_distance("kitten", "sitting"))\` },\r
      { lang: 'go', code: \`package main\r
\r
import "fmt"\r
\r
func editDistance(a, b string) int {\r
	m, n := len(a), len(b)\r
	dp := make([]int, n+1)\r
	for j := 0; j <= n; j++ {\r
		dp[j] = j\r
	}\r
	for i := 1; i <= m; i++ {\r
		prev := dp[0]\r
		dp[0] = i\r
		for j := 1; j <= n; j++ {\r
			cur := dp[j]\r
			if a[i-1] == b[j-1] {\r
				dp[j] = prev\r
			} else {\r
				dp[j] = 1 + min(dp[j], min(dp[j-1], prev))\r
			}\r
			prev = cur\r
		}\r
	}\r
	return dp[n]\r
}\r
\r
func min(x, y int) int {\r
	if x < y {\r
		return x\r
	}\r
	return y\r
}\r
\r
func main() { fmt.Println(editDistance("kitten", "sitting")) }\` },\r
      { lang: 'rust', code: \`fn edit_distance(a: &str, b: &str) -> usize {\r
    let (a, b) = (a.as_bytes(), b.as_bytes());\r
    let (m, n) = (a.len(), b.len());\r
    let mut dp: Vec<usize> = (0..=n).collect();\r
    for i in 1..=m {\r
        let mut prev = dp[0];\r
        dp[0] = i;\r
        for j in 1..=n {\r
            let cur = dp[j];\r
            dp[j] = if a[i-1] == b[j-1] { prev } else { 1 + dp[j].min(dp[j-1]).min(prev) };\r
            prev = cur;\r
        }\r
    }\r
    dp[n]\r
}\r
\r
fn main() { println!("{}", edit_distance("kitten", "sitting")); }\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
#include <string.h>\r
\r
int mn(int a, int b) { return a < b ? a : b; }\r
\r
int edit_distance(const char *a, const char *b) {\r
    int m = strlen(a), n = strlen(b), dp[64];\r
    for (int j = 0; j <= n; j++) dp[j] = j;\r
    for (int i = 1; i <= m; i++) {\r
        int prev = dp[0]; dp[0] = i;\r
        for (int j = 1; j <= n; j++) {\r
            int cur = dp[j];\r
            dp[j] = a[i-1] == b[j-1] ? prev : 1 + mn(dp[j], mn(dp[j-1], prev));\r
            prev = cur;\r
        }\r
    }\r
    return dp[n];\r
}\r
\r
int main(void) { printf("%d\\\\n", edit_distance("kitten", "sitting")); }\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <string>\r
#include <vector>\r
#include <algorithm>\r
\r
int edit_distance(const std::string& a, const std::string& b) {\r
    int m = a.size(), n = b.size();\r
    std::vector<int> dp(n + 1);\r
    for (int j = 0; j <= n; j++) dp[j] = j;\r
    for (int i = 1; i <= m; i++) {\r
        int prev = dp[0]; dp[0] = i;\r
        for (int j = 1; j <= n; j++) {\r
            int cur = dp[j];\r
            dp[j] = a[i-1] == b[j-1] ? prev : 1 + std::min({dp[j], dp[j-1], prev});\r
            prev = cur;\r
        }\r
    }\r
    return dp[n];\r
}\r
\r
int main() { std::cout << edit_distance("kitten", "sitting") << "\\\\n"; }\` },\r
    ],\r
  },\r
\r
  kmp: {\r
    intro: 'KMP string search — find a pattern in a text in O(n+m) by precomputing a "failure function" (longest proper prefix that is also a suffix) so a mismatch never rescans text. First index of "ababcabc" in "ababcababcabc" is 5.',\r
    expect: '5',\r
    snippets: [\r
      { lang: 'python', code: \`def kmp_search(text, pat):\r
    lps, k = [0] * len(pat), 0        # failure function\r
    for i in range(1, len(pat)):\r
        while k > 0 and pat[i] != pat[k]:\r
            k = lps[k-1]\r
        if pat[i] == pat[k]:\r
            k += 1\r
        lps[i] = k\r
    k = 0\r
    for i in range(len(text)):\r
        while k > 0 and text[i] != pat[k]:\r
            k = lps[k-1]\r
        if text[i] == pat[k]:\r
            k += 1\r
        if k == len(pat):\r
            return i - len(pat) + 1\r
    return -1\r
\r
print(kmp_search("ababcababcabc", "ababcabc"))\` },\r
      { lang: 'go', code: \`package main\r
\r
import "fmt"\r
\r
func kmpSearch(text, pat string) int {\r
	lps := make([]int, len(pat))\r
	k := 0\r
	for i := 1; i < len(pat); i++ {\r
		for k > 0 && pat[i] != pat[k] {\r
			k = lps[k-1]\r
		}\r
		if pat[i] == pat[k] {\r
			k++\r
		}\r
		lps[i] = k\r
	}\r
	k = 0\r
	for i := 0; i < len(text); i++ {\r
		for k > 0 && text[i] != pat[k] {\r
			k = lps[k-1]\r
		}\r
		if text[i] == pat[k] {\r
			k++\r
		}\r
		if k == len(pat) {\r
			return i - len(pat) + 1\r
		}\r
	}\r
	return -1\r
}\r
\r
func main() { fmt.Println(kmpSearch("ababcababcabc", "ababcabc")) }\` },\r
      { lang: 'rust', code: \`fn kmp_search(text: &str, pat: &str) -> i32 {\r
    let (text, pat) = (text.as_bytes(), pat.as_bytes());\r
    let mut lps = vec![0usize; pat.len()];\r
    let mut k = 0;\r
    for i in 1..pat.len() {\r
        while k > 0 && pat[i] != pat[k] { k = lps[k-1]; }\r
        if pat[i] == pat[k] { k += 1; }\r
        lps[i] = k;\r
    }\r
    k = 0;\r
    for i in 0..text.len() {\r
        while k > 0 && text[i] != pat[k] { k = lps[k-1]; }\r
        if text[i] == pat[k] { k += 1; }\r
        if k == pat.len() { return (i - pat.len() + 1) as i32; }\r
    }\r
    -1\r
}\r
\r
fn main() { println!("{}", kmp_search("ababcababcabc", "ababcabc")); }\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
#include <string.h>\r
\r
int kmp_search(const char *text, const char *pat) {\r
    int n = strlen(text), m = strlen(pat), lps[64] = {0}, k = 0;\r
    for (int i = 1; i < m; i++) {\r
        while (k > 0 && pat[i] != pat[k]) k = lps[k-1];\r
        if (pat[i] == pat[k]) k++;\r
        lps[i] = k;\r
    }\r
    k = 0;\r
    for (int i = 0; i < n; i++) {\r
        while (k > 0 && text[i] != pat[k]) k = lps[k-1];\r
        if (text[i] == pat[k]) k++;\r
        if (k == m) return i - m + 1;\r
    }\r
    return -1;\r
}\r
\r
int main(void) { printf("%d\\\\n", kmp_search("ababcababcabc", "ababcabc")); }\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <string>\r
#include <vector>\r
\r
int kmp_search(const std::string& text, const std::string& pat) {\r
    int n = text.size(), m = pat.size();\r
    std::vector<int> lps(m, 0);\r
    int k = 0;\r
    for (int i = 1; i < m; i++) {\r
        while (k > 0 && pat[i] != pat[k]) k = lps[k-1];\r
        if (pat[i] == pat[k]) k++;\r
        lps[i] = k;\r
    }\r
    k = 0;\r
    for (int i = 0; i < n; i++) {\r
        while (k > 0 && text[i] != pat[k]) k = lps[k-1];\r
        if (text[i] == pat[k]) k++;\r
        if (k == m) return i - m + 1;\r
    }\r
    return -1;\r
}\r
\r
int main() { std::cout << kmp_search("ababcababcabc", "ababcabc") << "\\\\n"; }\` },\r
    ],\r
  },\r
\r
  unionfind: {\r
    intro: 'Union-Find (disjoint-set) — track connected components under merges, near-O(1) per op with path compression. Starting with 10 singletons and unioning (0-1,1-2,3-4,5-6,6-7,7-3) leaves 4 components: {0,1,2}, {3,4,5,6,7}, {8}, {9}.',\r
    expect: '4',\r
    snippets: [\r
      { lang: 'python', code: \`def count_components(n, edges):\r
    parent = list(range(n))\r
    def find(x):\r
        while parent[x] != x:\r
            parent[x] = parent[parent[x]]   # path halving\r
            x = parent[x]\r
        return x\r
    for a, b in edges:\r
        parent[find(a)] = find(b)\r
    return len({find(i) for i in range(n)})\r
\r
print(count_components(10, [(0,1),(1,2),(3,4),(5,6),(6,7),(7,3)]))\` },\r
      { lang: 'go', code: \`package main\r
\r
import "fmt"\r
\r
func countComponents(n int, edges [][2]int) int {\r
	parent := make([]int, n)\r
	for i := range parent {\r
		parent[i] = i\r
	}\r
	var find func(int) int\r
	find = func(x int) int {\r
		for parent[x] != x {\r
			parent[x] = parent[parent[x]]\r
			x = parent[x]\r
		}\r
		return x\r
	}\r
	for _, e := range edges {\r
		parent[find(e[0])] = find(e[1])\r
	}\r
	roots := map[int]bool{}\r
	for i := 0; i < n; i++ {\r
		roots[find(i)] = true\r
	}\r
	return len(roots)\r
}\r
\r
func main() {\r
	fmt.Println(countComponents(10, [][2]int{{0, 1}, {1, 2}, {3, 4}, {5, 6}, {6, 7}, {7, 3}}))\r
}\` },\r
      { lang: 'rust', code: \`use std::collections::HashSet;\r
\r
fn find(parent: &mut Vec<usize>, mut x: usize) -> usize {\r
    while parent[x] != x {\r
        parent[x] = parent[parent[x]]; // path halving\r
        x = parent[x];\r
    }\r
    x\r
}\r
\r
fn count_components(n: usize, edges: &[(usize, usize)]) -> usize {\r
    let mut parent: Vec<usize> = (0..n).collect();\r
    for &(a, b) in edges {\r
        let (ra, rb) = (find(&mut parent, a), find(&mut parent, b));\r
        parent[ra] = rb;\r
    }\r
    (0..n).map(|i| find(&mut parent, i)).collect::<HashSet<_>>().len()\r
}\r
\r
fn main() {\r
    println!("{}", count_components(10, &[(0, 1), (1, 2), (3, 4), (5, 6), (6, 7), (7, 3)]));\r
}\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
\r
int parent[10];\r
\r
int find(int x) {\r
    while (parent[x] != x) { parent[x] = parent[parent[x]]; x = parent[x]; }\r
    return x;\r
}\r
\r
int main(void) {\r
    int n = 10, edges[6][2] = {{0,1},{1,2},{3,4},{5,6},{6,7},{7,3}};\r
    for (int i = 0; i < n; i++) parent[i] = i;\r
    for (int i = 0; i < 6; i++) parent[find(edges[i][0])] = find(edges[i][1]);\r
    int count = 0;\r
    for (int i = 0; i < n; i++) if (find(i) == i) count++;\r
    printf("%d\\\\n", count);\r
}\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <vector>\r
#include <set>\r
\r
std::vector<int> parent;\r
\r
int find(int x) {\r
    while (parent[x] != x) { parent[x] = parent[parent[x]]; x = parent[x]; }\r
    return x;\r
}\r
\r
int main() {\r
    int n = 10;\r
    std::vector<std::pair<int,int>> edges = {{0,1},{1,2},{3,4},{5,6},{6,7},{7,3}};\r
    parent.resize(n);\r
    for (int i = 0; i < n; i++) parent[i] = i;\r
    for (auto& e : edges) parent[find(e.first)] = find(e.second);\r
    std::set<int> roots;\r
    for (int i = 0; i < n; i++) roots.insert(find(i));\r
    std::cout << roots.size() << "\\\\n";\r
}\` },\r
    ],\r
  },\r
\r
  knapsack: {\r
    intro: '0/1 knapsack — the most valuable subset of items that fits a weight budget, each item taken at most once. With weights [1,3,4,5], values [1,4,5,7], capacity 7, the best is items 3+4 (weight 7, value 9).',\r
    expect: '9',\r
    snippets: [\r
      { lang: 'python', code: \`def knapsack(weights, values, cap):\r
    dp = [0] * (cap + 1)             # dp[w] = best value in weight w\r
    for i in range(len(weights)):\r
        for w in range(cap, weights[i] - 1, -1):   # iterate down so each item is used once\r
            dp[w] = max(dp[w], dp[w - weights[i]] + values[i])\r
    return dp[cap]\r
\r
print(knapsack([1, 3, 4, 5], [1, 4, 5, 7], 7))\` },\r
      { lang: 'go', code: \`package main\r
\r
import "fmt"\r
\r
func knapsack(weights, values []int, cap int) int {\r
	dp := make([]int, cap+1)\r
	for i := 0; i < len(weights); i++ {\r
		for w := cap; w >= weights[i]; w-- {\r
			if dp[w-weights[i]]+values[i] > dp[w] {\r
				dp[w] = dp[w-weights[i]] + values[i]\r
			}\r
		}\r
	}\r
	return dp[cap]\r
}\r
\r
func main() { fmt.Println(knapsack([]int{1, 3, 4, 5}, []int{1, 4, 5, 7}, 7)) }\` },\r
      { lang: 'rust', code: \`fn knapsack(weights: &[usize], values: &[i64], cap: usize) -> i64 {\r
    let mut dp = vec![0i64; cap + 1];\r
    for i in 0..weights.len() {\r
        for w in (weights[i]..=cap).rev() {   // down so each item is used once\r
            dp[w] = dp[w].max(dp[w - weights[i]] + values[i]);\r
        }\r
    }\r
    dp[cap]\r
}\r
\r
fn main() { println!("{}", knapsack(&[1, 3, 4, 5], &[1, 4, 5, 7], 7)); }\` },\r
      { lang: 'c', code: \`#include <stdio.h>\r
\r
int main(void) {\r
    int weights[] = {1, 3, 4, 5}, values[] = {1, 4, 5, 7}, cap = 7, dp[8] = {0};\r
    for (int i = 0; i < 4; i++)\r
        for (int w = cap; w >= weights[i]; w--) {\r
            int cand = dp[w - weights[i]] + values[i];\r
            if (cand > dp[w]) dp[w] = cand;\r
        }\r
    printf("%d\\\\n", dp[cap]);\r
}\` },\r
      { lang: 'cpp', code: \`#include <iostream>\r
#include <vector>\r
#include <algorithm>\r
\r
int main() {\r
    std::vector<int> weights = {1, 3, 4, 5}, values = {1, 4, 5, 7};\r
    int cap = 7;\r
    std::vector<int> dp(cap + 1, 0);\r
    for (size_t i = 0; i < weights.size(); i++)\r
        for (int w = cap; w >= (int)weights[i]; w--)\r
            dp[w] = std::max(dp[w], dp[w - weights[i]] + values[i]);\r
    std::cout << dp[cap] << "\\\\n";\r
}\` },\r
    ],\r
  },\r
  ...EXTRA_EXAMPLES,\r
  ...EXTRA2_EXAMPLES,\r
};\r
\r
export const hasExamples = (id: string): boolean => id in CODE_EXAMPLES;\r
export const examplesFor = (id: string): ExampleSet | undefined => CODE_EXAMPLES[id];\r
`;export{e as default};