"""Recommend a stable course/topic path for generated learning artifacts."""

import json
import logging
import re

from app.config import QWEN_API_KEY, QWEN_MODEL
from app.database import query
from app.services.llm import chat_qwen_model


logger = logging.getLogger(__name__)

UNCLASSIFIED_COURSE = "未分类课程"
UNCLASSIFIED_TOPIC = "未分类主题"


def _json(value, default):
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value or "")
    except (TypeError, json.JSONDecodeError):
        return default


def _clean(value: str | None, fallback: str = "") -> str:
    cleaned = " ".join(str(value or "").strip().split())
    return cleaned[:120] or fallback


def _normalize(value: str | None) -> str:
    return re.sub(r"[\s\-_—·/\\]+", "", str(value or "").lower())


def _unique(values) -> list[str]:
    result: list[str] = []
    for value in values:
        cleaned = _clean(value)
        if cleaned and cleaned not in result:
            result.append(cleaned)
    return result


def _taxonomy(user_id: int) -> list[dict]:
    try:
        return query(
            "SELECT c.name AS course_name, c.aliases, t.name AS topic_name, t.keywords "
            "FROM library_courses c LEFT JOIN library_topics t ON t.course_id = c.id "
            "WHERE c.user_id = %s ORDER BY c.updated_at DESC, t.updated_at DESC",
            (user_id,),
        )
    except Exception:
        logger.exception("读取资料库目录失败")
        return []


def _canonical_course(candidate: str, rows: list[dict]) -> str:
    normalized = _normalize(candidate)
    if not normalized:
        return ""
    for row in rows:
        course_name = _clean(row.get("course_name"))
        names = [course_name, *_json(row.get("aliases"), [])]
        for name in names:
            option = _normalize(name)
            if option and (normalized == option or normalized in option or option in normalized):
                return course_name
    return _clean(candidate)


def _canonical_topic(candidate: str, course_name: str, rows: list[dict]) -> str:
    normalized = _normalize(candidate)
    if not normalized:
        return ""
    course_normalized = _normalize(course_name)
    scoped = [row for row in rows if _normalize(row.get("course_name")) == course_normalized]
    for row in scoped:
        topic_name = _clean(row.get("topic_name"))
        names = [topic_name, *_json(row.get("keywords"), [])]
        for name in names:
            option = _normalize(name)
            if option and (normalized == option or normalized in option or option in normalized):
                return topic_name
    return _clean(candidate)


def _memory_recommendation(
    user_id: int,
    course_name: str,
    topic_name: str,
    content_text: str,
) -> dict | None:
    try:
        rows = query(
            "SELECT recommended_course_name, recommended_topic_name, final_course_name, "
            "final_topic_name, keywords FROM library_classification_feedback "
            "WHERE user_id = %s ORDER BY created_at DESC LIMIT 80",
            (user_id,),
        )
    except Exception:
        logger.exception("读取归档修正记忆失败")
        return None

    course_normalized = _normalize(course_name)
    topic_normalized = _normalize(topic_name)
    text_normalized = _normalize(content_text)
    best: tuple[int, dict] | None = None
    for row in rows:
        score = 0
        recommended_course = _normalize(row.get("recommended_course_name"))
        recommended_topic = _normalize(row.get("recommended_topic_name"))
        if course_normalized and course_normalized == recommended_course:
            score += 4
        if topic_normalized and topic_normalized == recommended_topic:
            score += 5
        for keyword in _json(row.get("keywords"), []):
            normalized = _normalize(keyword)
            if len(normalized) >= 3 and normalized in text_normalized:
                score += 2
        if score >= 7 and (best is None or score > best[0]):
            best = (score, row)
    if not best:
        return None
    row = best[1]
    return {
        "course_name": _clean(row.get("final_course_name"), UNCLASSIFIED_COURSE),
        "topic_name": _clean(row.get("final_topic_name"), UNCLASSIFIED_TOPIC),
        "source": "memory",
        "confidence": 0.98,
    }


def _library_recommendation(rows: list[dict], content_text: str) -> dict | None:
    normalized_text = _normalize(content_text)
    best: tuple[int, dict] | None = None
    for row in rows:
        score = 0
        course_name = _clean(row.get("course_name"))
        topic_name = _clean(row.get("topic_name"))
        if len(_normalize(course_name)) >= 2 and _normalize(course_name) in normalized_text:
            score += 3
        if len(_normalize(topic_name)) >= 2 and _normalize(topic_name) in normalized_text:
            score += 5
        for keyword in _json(row.get("keywords"), []):
            normalized = _normalize(keyword)
            if len(normalized) >= 2 and normalized in normalized_text:
                score += 2
        if topic_name and score >= 5 and (best is None or score > best[0]):
            best = (score, row)
    if not best:
        return None
    row = best[1]
    return {
        "course_name": _clean(row.get("course_name"), UNCLASSIFIED_COURSE),
        "topic_name": _clean(row.get("topic_name"), UNCLASSIFIED_TOPIC),
        "source": "library",
        "confidence": min(0.9, 0.72 + best[0] * 0.02),
    }


def _llm_recommendation(
    learning_state: dict,
    title: str,
    summary: str,
    source_prompt: str,
    rows: list[dict],
) -> dict | None:
    if not QWEN_API_KEY or not QWEN_MODEL:
        return None
    paths = _unique(
        f"{row.get('course_name', '')} / {row.get('topic_name', '')}"
        for row in rows
        if row.get("course_name") and row.get("topic_name")
    )[:60]
    messages = [
        {
            "role": "system",
            "content": (
                "你是 RHYME 的资料归档分类 Agent。根据学生当前学习需求，为资料推荐且只推荐一条“课程 / 主题”路径。"
                "优先复用已有路径；只有内容明确时才创建简短新名称；无法可靠判断时返回未分类课程/未分类主题。"
                "课程是稳定学科，主题是具体知识点，禁止创建更多层级。返回 JSON：course_name、topic_name、confidence。"
            ),
        },
        {
            "role": "user",
            "content": (
                f"学习状态：{json.dumps(learning_state, ensure_ascii=False)}\n"
                f"资料标题：{title}\n资料摘要：{summary}\n用户需求：{source_prompt[:1200]}\n"
                f"已有路径：{json.dumps(paths, ensure_ascii=False)}"
            ),
        },
    ]
    try:
        response = chat_qwen_model("qwen-flash", messages, temperature=0.1, max_tokens=260, json_mode=True)
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
        return {
            "course_name": _clean(data.get("course_name"), UNCLASSIFIED_COURSE),
            "topic_name": _clean(data.get("topic_name"), UNCLASSIFIED_TOPIC),
            "source": "llm",
            "confidence": max(0.0, min(1.0, float(data.get("confidence") or 0.65))),
        }
    except Exception:
        logger.exception("智能归档分类失败，回退到规则推荐")
        return None


def recommend_library_path(
    *,
    user_id: int,
    learning_state: dict,
    title: str,
    summary: str,
    source_prompt: str,
    highlights: list[str] | None = None,
) -> dict:
    """Return a non-blocking recommendation with memory and deterministic fallbacks."""
    knowledge_points = _unique(learning_state.get("knowledge_points") or [])
    state_course = _clean(learning_state.get("subject"))
    state_topic = _clean(learning_state.get("current_topic") or (knowledge_points[0] if knowledge_points else ""))
    content_text = "\n".join([title, summary, source_prompt, *knowledge_points, *(highlights or [])])
    rows = _taxonomy(user_id)

    recommendation = _memory_recommendation(user_id, state_course, state_topic, content_text)
    if recommendation:
        recommendation["keywords"] = knowledge_points
        return recommendation

    if state_course and state_topic:
        return {
            "course_name": _canonical_course(state_course, rows),
            "topic_name": _canonical_topic(state_topic, _canonical_course(state_course, rows), rows),
            "source": "learning_state",
            "confidence": 0.92,
            "keywords": knowledge_points,
        }

    recommendation = _library_recommendation(rows, content_text)
    if recommendation:
        recommendation["keywords"] = knowledge_points
        return recommendation

    recommendation = _llm_recommendation(learning_state, title, summary, source_prompt, rows)
    if recommendation:
        recommendation["course_name"] = _canonical_course(recommendation["course_name"], rows)
        recommendation["topic_name"] = _canonical_topic(
            recommendation["topic_name"], recommendation["course_name"], rows,
        )
        recommendation["keywords"] = knowledge_points
        return recommendation

    return {
        "course_name": state_course or UNCLASSIFIED_COURSE,
        "topic_name": state_topic or UNCLASSIFIED_TOPIC,
        "source": "fallback",
        "confidence": 0.55 if state_course or state_topic else 0.2,
        "keywords": knowledge_points,
    }
