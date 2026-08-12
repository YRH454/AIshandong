"""Read-only discovery of external learning videos.

The app links learners to an original Bilibili page instead of downloading or
rehosting a video. We prefer Bilibili's public result feed because it provides
the real cover, creator and duration. If it is temporarily unavailable, a
public web index supplies a small fallback. Neither route works around a
CAPTCHA or fabricates a video.
"""

from __future__ import annotations

import html
import re
import time
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import httpx


_CACHE_TTL_SECONDS = 300
_cache: dict[str, tuple[float, list[dict]]] = {}
_BILIBILI_HOSTS = {"bilibili.com", "www.bilibili.com", "m.bilibili.com"}
_VIDEO_ID_PATTERN = re.compile(r"/(?:video/)?(BV[0-9A-Za-z]+)", re.I)
_BILIBILI_SEARCH_ENDPOINTS = (
    "https://api.bilibili.com/x/web-interface/wbi/search/type",
    "https://api.bilibili.com/x/web-interface/search/type",
)
_QUERY_FILLER_WORDS = {
    "帮我", "请", "一下", "这个", "那个", "什么", "怎么", "如何", "为什么", "可以",
    "学习", "复习", "预习", "讲解", "解释", "理解", "掌握", "看看", "视频", "课程",
    "一直", "但是", "然后", "因为", "所以", "通俗", "方式", "告诉", "明白", "要考",
    "三天后", "三天", "后要", "先用", "今天", "现在", "已经", "还没", "不会", "问题", "内容", "知识点",
}


def build_bilibili_search_url(query: str) -> str:
    """Return the official Bilibili search page for a learner-controlled query."""
    return f"https://search.bilibili.com/all?keyword={quote_plus(_clean_text(query, 180))}"


def normalize_bilibili_video_url(value: str) -> str | None:
    """Accept a Bilibili video page and return its canonical, safe-to-open URL."""
    raw = html.unescape(str(value or "").strip())
    if raw.startswith("//"):
        raw = f"https:{raw}"
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if host not in _BILIBILI_HOSTS:
        return None
    match = _VIDEO_ID_PATTERN.search(parsed.path)
    if not match:
        return None
    return f"https://www.bilibili.com/video/{match.group(1)}/"


def search_bilibili_videos(query: str, limit: int = 4) -> list[dict]:
    """Find genuine Bilibili pages through a public search index.

    Results contain only metadata present in the indexed page. Missing creator
    or duration information is intentionally left blank instead of guessed.
    """
    clean_query = _clean_text(query, 160)
    if not clean_query:
        return []
    search_query = _learning_search_query(clean_query)
    result_limit = max(1, min(int(limit or 4), 6))
    cache_key = f"{clean_query.lower()}:{result_limit}"
    cached = _cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < _CACHE_TTL_SECONDS:
        return [dict(item) for item in cached[1]]

    results = _search_bilibili_public_feed(search_query, result_limit)
    seen_urls = {item["url"] for item in results}
    if len(results) >= result_limit:
        _cache[cache_key] = (time.monotonic(), results)
        return [dict(item) for item in results]

    try:
        response = httpx.get(
            "https://html.duckduckgo.com/html/",
            params={"q": f"site:bilibili.com/video {search_query}"},
            headers={"User-Agent": "Mozilla/5.0 (compatible; RHYME-Learning-Resource/1.0)"},
            follow_redirects=True,
            timeout=12,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        _cache[cache_key] = (time.monotonic(), results)
        return [dict(item) for item in results]

    for href, title_html, snippet_html in _result_matches(response.text):
        url = normalize_bilibili_video_url(_unwrap_search_url(href))
        if not url or url in seen_urls:
            continue
        title = _clean_text(_strip_html(title_html), 180)
        snippet = _clean_text(_strip_html(snippet_html), 420)
        if not title or _relevance_score(title, snippet, search_query) <= 0:
            continue
        seen_urls.add(url)
        results.append({
            "platform": "bilibili",
            "platform_label": "B站",
            "title": title.removesuffix("_哔哩哔哩_bilibili").strip(),
            "url": url,
            "creator": _extract_creator(snippet),
            "duration": _extract_duration(f"{title} {snippet}"),
            "description": snippet,
            "recommendation": _recommendation(title, snippet, search_query),
        })
        if len(results) >= result_limit:
            break

    _cache[cache_key] = (time.monotonic(), results)
    return [dict(item) for item in results]


def _search_bilibili_public_feed(query: str, limit: int) -> list[dict]:
    """Read the platform's public video-result feed when it is available."""
    payload: dict | None = None
    for endpoint in _BILIBILI_SEARCH_ENDPOINTS:
        try:
            response = httpx.get(
                endpoint,
                params={"search_type": "video", "keyword": query},
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; RHYME-Learning-Resource/1.0)",
                    "Referer": "https://www.bilibili.com/",
                },
                timeout=10,
            )
            response.raise_for_status()
            candidate = response.json()
        except (httpx.HTTPError, ValueError):
            continue
        if candidate.get("code") == 0:
            payload = candidate
            break

    if payload is None:
        return []
    raw_results = payload.get("data", {}).get("result", [])
    if not isinstance(raw_results, list):
        return []

    results: list[dict] = []
    seen_urls: set[str] = set()
    for raw in raw_results:
        if not isinstance(raw, dict):
            continue
        bvid = _clean_text(raw.get("bvid", ""), 32)
        url = normalize_bilibili_video_url(f"https://www.bilibili.com/video/{bvid}/")
        if not url or url in seen_urls:
            continue
        title = _clean_text(_strip_html(raw.get("title", "")), 180)
        description = _clean_text(_strip_html(raw.get("description", "")), 420)
        tags = _clean_text(_strip_html(raw.get("tag", "")), 160)
        if not title or _relevance_score(title, f"{description} {tags}", query) <= 0:
            continue
        seen_urls.add(url)
        cover_url = normalize_bilibili_cover_url(raw.get("pic", ""))
        creator = _clean_text(raw.get("author", ""), 80)
        duration = _clean_text(raw.get("duration", ""), 40)
        results.append({
            "platform": "bilibili",
            "platform_label": "B站",
            "title": title,
            "url": url,
            "cover_url": cover_url,
            "creator": creator,
            "duration": duration,
            "view_count": _format_count(raw.get("play"), "播放"),
            "description": description,
            "recommendation": _recommendation(title, f"{description} {tags}", query),
        })
        if len(results) >= limit:
            break
    return results


def _result_matches(page: str) -> list[tuple[str, str, str]]:
    # DuckDuckGo's lightweight HTML is stable enough for a read-only fallback.
    pattern = re.compile(
        r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>.*?'
        r'<a[^>]+class="result__snippet"[^>]*>(.*?)</a>',
        re.IGNORECASE | re.DOTALL,
    )
    return pattern.findall(page)


def _unwrap_search_url(value: str) -> str:
    raw = html.unescape(value or "")
    if raw.startswith("//"):
        raw = f"https:{raw}"
    parsed = urlparse(raw)
    if parsed.hostname and "duckduckgo.com" in parsed.hostname:
        destination = parse_qs(parsed.query).get("uddg", [""])[0]
        return unquote(destination)
    return raw


def _strip_html(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", value or ""))


def _clean_text(value: str, limit: int) -> str:
    return " ".join(str(value or "").replace("\xa0", " ").split())[:limit]


def _learning_search_query(query: str) -> str:
    """Keep subject terms from a natural-language learning request.

    A learner often writes a whole sentence ("I have an exam soon and do not
    understand recursion") rather than a search-engine query. Existing jieba
    use elsewhere in the app gives us a light, local way to retain the useful
    course/topic terms without spending another model call.
    """
    try:
        import jieba

        tokens = jieba.lcut(query)
    except ImportError:
        tokens = re.split(r"[\s，。！？、；：,.!?]+", query)

    selected: list[str] = []
    for token in tokens:
        value = _clean_text(token, 24)
        if len(value) < 2 or value in _QUERY_FILLER_WORDS or value.isdecimal():
            continue
        if value not in selected:
            selected.append(value)
    return " ".join(selected[:4]) or query


def _extract_creator(snippet: str) -> str:
    match = re.search(r"(?:视频作者|UP主)\s*[:：]?\s*([^，,。；;]+)", snippet)
    return _clean_text(match.group(1), 60) if match else ""


def _extract_duration(text: str) -> str:
    match = re.search(r"(\d+(?:\.\d+)?\s*(?:分钟|分(?:钟)?|小时|秒))", text)
    return match.group(1).replace("分", "分钟") if match and "分钟" not in match.group(1) else (match.group(1) if match else "")


def normalize_bilibili_cover_url(value: object) -> str:
    cover = html.unescape(str(value or "").strip())
    if cover.startswith("//"):
        cover = f"https:{cover}"
    parsed = urlparse(cover)
    if parsed.scheme != "https" or not (parsed.hostname or "").endswith("hdslb.com"):
        return ""
    return cover


def _format_count(value: object, label: str) -> str:
    try:
        count = int(value or 0)
    except (TypeError, ValueError):
        return ""
    if count <= 0:
        return ""
    if count >= 10_000:
        return f"{label} {count / 10_000:.1f}万".replace(".0万", "万")
    return f"{label} {count}"


def _relevance_score(title: str, supporting_text: str, query: str) -> int:
    """Discard generic platform pages and keep topic-related course videos."""
    tokens = [token for token in re.split(r"\s+", _clean_text(query, 160)) if len(token) >= 2]
    if not tokens:
        return 1
    title_lower = title.lower()
    supporting_lower = supporting_text.lower()
    score = 0
    for token in tokens:
        lowered = token.lower()
        if lowered in title_lower:
            score += 4
        elif lowered in supporting_lower:
            score += 1
    return score


def _recommendation(title: str, snippet: str, query: str) -> str:
    combined = f"{title} {snippet}".lower()
    if any(token in combined for token in ("零基础", "入门", "小白")):
        return "从基础概念开始，适合先建立直觉。"
    if any(token in combined for token in ("合集", "系列", "共计")):
        return "包含多个章节，适合系统补齐这一主题。"
    if any(token in combined for token in ("十分钟", "速成", "快速")):
        return "内容聚焦，适合快速补一个关键点。"
    return f"覆盖“{query}”相关内容，可作为当前学习的外部补充。"
