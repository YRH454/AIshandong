"""Conversation-native learning artifact persistence."""

import json

from app.database import _ensure_column, execute, insert, query


def _json(value, default):
    if isinstance(value, (dict, list)):
        return value
    if not value:
        return default
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


def init_tables():
    execute("""
        CREATE TABLE IF NOT EXISTS library_courses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(120) NOT NULL,
            aliases JSON NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE(user_id, name)
        )
    """)
    execute("""
        CREATE TABLE IF NOT EXISTS library_topics (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            course_id INT NOT NULL,
            name VARCHAR(120) NOT NULL,
            keywords JSON NOT NULL,
            mastery INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE(course_id, name)
        )
    """)
    execute("""
        CREATE TABLE IF NOT EXISTS learning_artifacts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_id INT NOT NULL,
            qa_id VARCHAR(100) NOT NULL,
            kind VARCHAR(40) NOT NULL DEFAULT 'notes',
            title VARCHAR(180) NOT NULL,
            summary TEXT NOT NULL,
            highlights JSON NOT NULL,
            content TEXT NOT NULL,
            source_prompt TEXT NOT NULL,
            purpose VARCHAR(30) NOT NULL,
            depth VARCHAR(30) NOT NULL,
            style VARCHAR(30) NOT NULL,
            course_id INT,
            topic_id INT,
            folder VARCHAR(220) DEFAULT '',
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            version INT NOT NULL DEFAULT 1,
            is_favorite TINYINT NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    """)
    _ensure_column("learning_artifacts", "course_id", "INT")
    _ensure_column("learning_artifacts", "topic_id", "INT")
    _ensure_column("learning_artifacts", "version", "INT NOT NULL DEFAULT 1")
    _ensure_column("learning_artifacts", "is_favorite", "TINYINT NOT NULL DEFAULT 0")


def _clean_name(value: str, fallback: str) -> str:
    cleaned = " ".join(str(value or "").strip().split())
    return cleaned[:120] or fallback


def ensure_library_path(user_id: int, course_name: str, topic_name: str, keywords: list | None = None) -> tuple[int, int]:
    course_name = _clean_name(course_name, "未分类课程")
    topic_name = _clean_name(topic_name, "未分类主题")
    courses = query(
        "SELECT id FROM library_courses WHERE user_id = %s AND name = %s",
        (user_id, course_name),
    )
    course_id = courses[0]["id"] if courses else insert("library_courses", {
        "user_id": user_id,
        "name": course_name,
        "aliases": json.dumps([], ensure_ascii=False),
    })
    topics = query(
        "SELECT id FROM library_topics WHERE user_id = %s AND course_id = %s AND name = %s",
        (user_id, course_id, topic_name),
    )
    if topics:
        topic_id = topics[0]["id"]
    else:
        topic_id = insert("library_topics", {
            "user_id": user_id,
            "course_id": course_id,
            "name": topic_name,
            "keywords": json.dumps(keywords or [], ensure_ascii=False),
        })
    return course_id, topic_id


def create_artifact(data: dict) -> dict:
    payload = dict(data)
    course_name = payload.pop("course_name", "未分类课程")
    topic_name = payload.pop("topic_name", "未分类主题")
    keywords = payload.pop("keywords", [])
    course_id, topic_id = ensure_library_path(payload["user_id"], course_name, topic_name, keywords)
    artifact_id = insert("learning_artifacts", {
        **payload,
        "course_id": course_id,
        "topic_id": topic_id,
        "highlights": json.dumps(payload.get("highlights", []), ensure_ascii=False),
    })
    return get_artifact(artifact_id, payload["user_id"])


_ARTIFACT_SELECT = (
    "SELECT a.*, c.name AS course_name, t.name AS topic_name "
    "FROM learning_artifacts a "
    "LEFT JOIN library_courses c ON c.id = a.course_id "
    "LEFT JOIN library_topics t ON t.id = a.topic_id "
)


def get_artifact(artifact_id: int, user_id: int) -> dict | None:
    rows = query(
        _ARTIFACT_SELECT + "WHERE a.id = %s AND a.user_id = %s",
        (artifact_id, user_id),
    )
    return _row(rows[0]) if rows else None


def list_artifacts(user_id: int, session_id: int | None = None, status: str = "all") -> list[dict]:
    clauses = ["a.user_id = %s"]
    params: list = [user_id]
    if session_id is not None:
        clauses.append("a.session_id = %s")
        params.append(session_id)
    if status in {"draft", "saved"}:
        clauses.append("a.status = %s")
        params.append(status)
    rows = query(
        _ARTIFACT_SELECT + f"WHERE {' AND '.join(clauses)} ORDER BY a.updated_at DESC",
        tuple(params),
    )
    return [_row(row) for row in rows]


def save_artifact(artifact_id: int, user_id: int, title: str, course_name: str, topic_name: str) -> dict | None:
    existing = get_artifact(artifact_id, user_id)
    if not existing:
        return None
    course_id, topic_id = ensure_library_path(user_id, course_name, topic_name)
    version_rows = query(
        "SELECT MAX(version) AS max_version FROM learning_artifacts "
        "WHERE user_id = %s AND course_id = %s AND topic_id = %s AND kind = %s AND title = %s "
        "AND status = 'saved' AND id <> %s",
        (user_id, course_id, topic_id, existing["kind"], title, artifact_id),
    )
    version = int(version_rows[0].get("max_version") or 0) + 1
    execute(
        "UPDATE learning_artifacts SET title = %s, course_id = %s, topic_id = %s, version = %s, "
        "status = 'saved', updated_at = NOW() "
        "WHERE id = %s AND user_id = %s",
        (title, course_id, topic_id, version, artifact_id, user_id),
    )
    return get_artifact(artifact_id, user_id)


def set_artifact_favorite(artifact_id: int, user_id: int, favorite: bool) -> dict | None:
    existing = get_artifact(artifact_id, user_id)
    if not existing:
        return None
    execute(
        "UPDATE learning_artifacts SET is_favorite = %s, updated_at = NOW() WHERE id = %s AND user_id = %s",
        (favorite, artifact_id, user_id),
    )
    return get_artifact(artifact_id, user_id)


def _row(row: dict) -> dict:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "session_id": row["session_id"],
        "qa_id": row["qa_id"],
        "kind": row.get("kind", "notes"),
        "title": row.get("title", "学习文档"),
        "summary": row.get("summary", ""),
        "highlights": _json(row.get("highlights"), []),
        "content": row.get("content", ""),
        "source_prompt": row.get("source_prompt", ""),
        "purpose": row.get("purpose", "review"),
        "depth": row.get("depth", "standard"),
        "style": row.get("style", "plain"),
        "course_name": row.get("course_name") or "未分类课程",
        "topic_name": row.get("topic_name") or "未分类主题",
        "status": row.get("status", "draft"),
        "version": int(row.get("version") or 1),
        "is_favorite": bool(row.get("is_favorite", 0)),
        "created_at": str(row.get("created_at", "")),
        "updated_at": str(row.get("updated_at", "")),
    }
