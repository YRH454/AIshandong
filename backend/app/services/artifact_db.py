"""Conversation-native learning artifact persistence."""

import json
import re
from difflib import SequenceMatcher

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
            document_template VARCHAR(40) NOT NULL DEFAULT 'system_guide',
            course_id INT,
            topic_id INT,
            recommended_course_name VARCHAR(120) DEFAULT '',
            recommended_topic_name VARCHAR(120) DEFAULT '',
            classification_source VARCHAR(30) NOT NULL DEFAULT 'fallback',
            classification_confidence FLOAT NOT NULL DEFAULT 0,
            classification_overridden TINYINT NOT NULL DEFAULT 0,
            classification_keywords JSON,
            folder VARCHAR(220) DEFAULT '',
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            version_group_id INT,
            version INT NOT NULL DEFAULT 1,
            is_favorite TINYINT NOT NULL DEFAULT 0,
            learning_loop_id VARCHAR(120) DEFAULT '',
            learning_loop_step VARCHAR(40) DEFAULT '',
            document_pack_id VARCHAR(120) DEFAULT '',
            document_pack_template VARCHAR(40) DEFAULT '',
            practice_pack_id VARCHAR(120) DEFAULT '',
            practice_pack_mode VARCHAR(40) DEFAULT '',
            deleted_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    """)
    execute("""
        CREATE TABLE IF NOT EXISTS library_classification_feedback (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            artifact_id INT NOT NULL,
            recommended_course_name VARCHAR(120) NOT NULL,
            recommended_topic_name VARCHAR(120) NOT NULL,
            final_course_name VARCHAR(120) NOT NULL,
            final_topic_name VARCHAR(120) NOT NULL,
            keywords JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    _ensure_column("learning_artifacts", "course_id", "INT")
    _ensure_column("learning_artifacts", "topic_id", "INT")
    _ensure_column("learning_artifacts", "recommended_course_name", "VARCHAR(120) DEFAULT ''")
    _ensure_column("learning_artifacts", "recommended_topic_name", "VARCHAR(120) DEFAULT ''")
    _ensure_column("learning_artifacts", "classification_source", "VARCHAR(30) NOT NULL DEFAULT 'fallback'")
    _ensure_column("learning_artifacts", "classification_confidence", "FLOAT NOT NULL DEFAULT 0")
    _ensure_column("learning_artifacts", "classification_overridden", "TINYINT NOT NULL DEFAULT 0")
    _ensure_column("learning_artifacts", "classification_keywords", "JSON")
    _ensure_column("learning_artifacts", "version_group_id", "INT")
    _ensure_column("learning_artifacts", "version", "INT NOT NULL DEFAULT 1")
    _ensure_column("learning_artifacts", "is_favorite", "TINYINT NOT NULL DEFAULT 0")
    _ensure_column("learning_artifacts", "source_map_artifact_id", "INT")
    _ensure_column("learning_artifacts", "document_template", "VARCHAR(40) NOT NULL DEFAULT 'system_guide'")
    _ensure_column("learning_artifacts", "learning_loop_id", "VARCHAR(120) DEFAULT ''")
    _ensure_column("learning_artifacts", "learning_loop_step", "VARCHAR(40) DEFAULT ''")
    _ensure_column("learning_artifacts", "document_pack_id", "VARCHAR(120) DEFAULT ''")
    _ensure_column("learning_artifacts", "document_pack_template", "VARCHAR(40) DEFAULT ''")
    _ensure_column("learning_artifacts", "practice_pack_id", "VARCHAR(120) DEFAULT ''")
    _ensure_column("learning_artifacts", "practice_pack_mode", "VARCHAR(40) DEFAULT ''")
    _ensure_column("learning_artifacts", "deleted_at", "DATETIME")
    execute(
        "UPDATE learning_artifacts SET version_group_id = id "
        "WHERE version_group_id IS NULL AND status <> 'draft'"
    )


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
    course_name = _clean_name(payload.pop("course_name", "未分类课程"), "未分类课程")
    topic_name = _clean_name(payload.pop("topic_name", "未分类主题"), "未分类主题")
    recommended_course_name = _clean_name(
        payload.pop("recommended_course_name", course_name),
        "未分类课程",
    )
    recommended_topic_name = _clean_name(
        payload.pop("recommended_topic_name", topic_name),
        "未分类主题",
    )
    keywords = payload.pop("keywords", [])
    classification_keywords = payload.pop("classification_keywords", keywords)
    course_id = None
    topic_id = None
    if payload.get("status") == "saved":
        course_id, topic_id = ensure_library_path(payload["user_id"], course_name, topic_name, keywords)
    artifact_id = insert("learning_artifacts", {
        **payload,
        "course_id": course_id,
        "topic_id": topic_id,
        "recommended_course_name": recommended_course_name,
        "recommended_topic_name": recommended_topic_name,
        "classification_keywords": json.dumps(classification_keywords or [], ensure_ascii=False),
        "highlights": json.dumps(payload.get("highlights", []), ensure_ascii=False),
    })
    if payload.get("status") == "saved":
        execute(
            "UPDATE learning_artifacts SET version_group_id = %s WHERE id = %s",
            (artifact_id, artifact_id),
        )
    return get_artifact(artifact_id, payload["user_id"])


_ARTIFACT_SELECT = (
    "SELECT a.*, c.name AS course_name, t.name AS topic_name, t.mastery AS topic_mastery "
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
    if status in {"draft", "saved", "deleted"}:
        clauses.append("a.status = %s")
        params.append(status)
        if status in {"saved", "deleted"}:
            clauses.append(
                "a.version = (SELECT MAX(v.version) FROM learning_artifacts v "
                "WHERE v.user_id = a.user_id AND COALESCE(v.version_group_id, v.id) = "
                "COALESCE(a.version_group_id, a.id) AND v.status = a.status)"
            )
    else:
        clauses.append("a.status <> 'deleted'")
        clauses.append(
            "(a.status <> 'saved' OR a.version = (SELECT MAX(v.version) FROM learning_artifacts v "
            "WHERE v.user_id = a.user_id AND COALESCE(v.version_group_id, v.id) = "
            "COALESCE(a.version_group_id, a.id) AND v.status = 'saved'))"
        )
    rows = query(
        _ARTIFACT_SELECT + f"WHERE {' AND '.join(clauses)} ORDER BY a.updated_at DESC",
        tuple(params),
    )
    return [_row(row) for row in rows]


def save_artifact(
    artifact_id: int,
    user_id: int,
    title: str,
    course_name: str,
    topic_name: str,
    strategy: str = "separate",
    duplicate_artifact_id: int | None = None,
) -> dict | None:
    existing = get_artifact(artifact_id, user_id)
    if not existing or existing.get("status") != "draft":
        return None
    if strategy not in {"separate", "version", "update"}:
        return None
    course_id, topic_id = ensure_library_path(user_id, course_name, topic_name)
    duplicate = get_artifact(duplicate_artifact_id, user_id) if duplicate_artifact_id else None
    if strategy in {"version", "update"}:
        if (
            not duplicate
            or duplicate.get("status") != "saved"
            or duplicate.get("kind") != existing.get("kind")
            or duplicate.get("course_id") != course_id
            or duplicate.get("topic_id") != topic_id
        ):
            return None
    overridden = not _same_path(
        existing.get("recommended_course_name"),
        existing.get("recommended_topic_name"),
        course_name,
        topic_name,
    )
    if strategy == "update" and duplicate:
        execute(
            "UPDATE practice_sets SET artifact_id = %s WHERE artifact_id = %s AND user_id = %s",
            (duplicate["id"], artifact_id, user_id),
        )
        execute(
            "UPDATE learning_artifacts SET title = %s, summary = %s, highlights = %s, content = %s, "
            "source_prompt = %s, purpose = %s, depth = %s, style = %s, document_template = %s, course_id = %s, topic_id = %s, "
            "recommended_course_name = %s, recommended_topic_name = %s, classification_source = %s, "
            "classification_confidence = %s, classification_overridden = %s, classification_keywords = %s, "
            "source_map_artifact_id = %s, updated_at = NOW() WHERE id = %s AND user_id = %s AND status = 'saved'",
            (
                title, existing["summary"], json.dumps(existing["highlights"], ensure_ascii=False),
                existing["content"], existing["source_prompt"], existing["purpose"], existing["depth"],
                existing["style"], existing.get("document_template", "system_guide"), course_id, topic_id, existing["recommended_course_name"],
                existing["recommended_topic_name"], existing["classification_source"],
                existing["classification_confidence"], overridden,
                json.dumps(existing["classification_keywords"], ensure_ascii=False), existing.get("source_map_artifact_id"),
                duplicate["id"], user_id,
            ),
        )
        execute(
            "DELETE FROM learning_artifacts WHERE id = %s AND user_id = %s AND status = 'draft'",
            (artifact_id, user_id),
        )
        saved_id = duplicate["id"]
    else:
        if strategy == "version" and duplicate:
            version_group_id = _version_group_id(duplicate)
            version_rows = query(
                "SELECT MAX(version) AS max_version FROM learning_artifacts "
                "WHERE user_id = %s AND COALESCE(version_group_id, id) = %s AND status = 'saved'",
                (user_id, version_group_id),
            )
            version = int(version_rows[0].get("max_version") or 0) + 1
            favorite = duplicate.get("is_favorite", False)
        else:
            version_group_id = artifact_id
            version = 1
            favorite = False
        execute(
            "UPDATE learning_artifacts SET title = %s, course_id = %s, topic_id = %s, "
            "version_group_id = %s, version = %s, is_favorite = %s, status = 'saved', "
            "classification_overridden = %s, deleted_at = NULL, updated_at = NOW() "
            "WHERE id = %s AND user_id = %s AND status = 'draft'",
            (title, course_id, topic_id, version_group_id, version, favorite, overridden, artifact_id, user_id),
        )
        saved_id = artifact_id
    if overridden:
        _record_classification_feedback(existing, course_name, topic_name)
    return get_artifact(saved_id, user_id)


def save_learning_loop(
    user_id: int,
    artifacts: list[dict],
    course_name: str,
    topic_name: str,
    learning_loop_id: str,
) -> list[dict]:
    """Save a generated learning set as one durable course/topic bundle."""
    loop_id = str(learning_loop_id or "").strip()[:120]
    if not loop_id or not artifacts:
        raise ValueError("学习闭环信息不完整")

    allowed_steps = {"notes", "map", "interactive", "practice"}
    if len(artifacts) != len(allowed_steps):
        raise ValueError("学习闭环必须包含文档、图解、动态讲解和练习四份资料")

    seen_ids: set[int] = set()
    seen_steps: set[str] = set()
    pending: list[tuple[dict, str]] = []
    for item in artifacts:
        artifact_id = int(item.get("artifact_id") or 0)
        step = str(item.get("step") or "").strip()
        if not artifact_id or artifact_id in seen_ids or step not in allowed_steps or step in seen_steps:
            raise ValueError("学习闭环中的资料信息无效")
        seen_ids.add(artifact_id)
        seen_steps.add(step)
        artifact = get_artifact(artifact_id, user_id)
        if not artifact or artifact.get("status") not in {"draft", "saved"}:
            raise ValueError("这套资料已有变更，请刷新后重新确认")
        pending.append((artifact, step))

    if seen_steps != allowed_steps:
        raise ValueError("学习闭环必须包含文档、图解、动态讲解和练习四份资料")

    saved: list[dict] = []
    for artifact, step in pending:
        if artifact.get("status") == "draft":
            archived = save_artifact(
                artifact["id"],
                user_id,
                artifact["title"],
                course_name,
                topic_name,
                "separate",
            )
        else:
            archived = update_artifact_metadata(
                artifact["id"],
                user_id,
                artifact["title"],
                course_name,
                topic_name,
            )
        if not archived:
            raise ValueError("保存学习闭环时发生变化，请重新确认")
        execute(
            "UPDATE learning_artifacts SET learning_loop_id = %s, learning_loop_step = %s, updated_at = NOW() "
            "WHERE id = %s AND user_id = %s",
            (loop_id, step, archived["id"], user_id),
        )
        saved_artifact = get_artifact(archived["id"], user_id)
        if saved_artifact:
            saved.append(saved_artifact)
    return saved


def save_document_pack(
    user_id: int,
    artifacts: list[dict],
    course_name: str,
    topic_name: str,
    document_pack_id: str,
) -> list[dict]:
    """Archive several document templates as one course/topic study pack."""
    pack_id = str(document_pack_id or "").strip()[:120]
    if not pack_id or not artifacts:
        raise ValueError("学习资料包信息不完整")

    seen_ids: set[int] = set()
    seen_templates: set[str] = set()
    pending: list[tuple[dict, str]] = []
    for item in artifacts:
        artifact_id = int(item.get("artifact_id") or 0)
        template = str(item.get("document_template") or "").strip()
        if not artifact_id or artifact_id in seen_ids or not template or template in seen_templates:
            raise ValueError("学习资料包中的文档信息无效")
        seen_ids.add(artifact_id)
        seen_templates.add(template)
        artifact = get_artifact(artifact_id, user_id)
        if not artifact or artifact.get("kind") != "notes" or artifact.get("status") not in {"draft", "saved"}:
            raise ValueError("资料包中的文档已发生变化，请刷新后重新确认")
        if artifact.get("document_template") != template:
            raise ValueError("资料包中的文档模板不匹配，请刷新后重新确认")
        pending.append((artifact, template))

    saved: list[dict] = []
    for artifact, template in pending:
        if artifact.get("status") == "draft":
            archived = save_artifact(
                artifact["id"], user_id, artifact["title"], course_name, topic_name, "separate",
            )
        else:
            archived = update_artifact_metadata(
                artifact["id"], user_id, artifact["title"], course_name, topic_name,
            )
        if not archived:
            raise ValueError("保存学习资料包时发生变化，请重新确认")
        execute(
            "UPDATE learning_artifacts SET document_pack_id = %s, document_pack_template = %s, updated_at = NOW() "
            "WHERE id = %s AND user_id = %s",
            (pack_id, template, archived["id"], user_id),
        )
        saved_artifact = get_artifact(archived["id"], user_id)
        if saved_artifact:
            saved.append(saved_artifact)
    return saved


def save_practice_pack(
    user_id: int,
    artifacts: list[dict],
    course_name: str,
    topic_name: str,
    practice_pack_id: str,
) -> list[dict]:
    """Archive six complementary practice sets as one course/topic training pack."""
    pack_id = str(practice_pack_id or "").strip()[:120]
    if not pack_id or not artifacts:
        raise ValueError("练习资源包信息不完整")

    allowed_modes = {"similar", "variants", "special", "mock", "coding", "oral"}
    seen_ids: set[int] = set()
    seen_modes: set[str] = set()
    pending: list[tuple[dict, str]] = []
    for item in artifacts:
        artifact_id = int(item.get("artifact_id") or 0)
        mode = str(item.get("practice_mode") or "").strip()
        if not artifact_id or artifact_id in seen_ids or mode not in allowed_modes or mode in seen_modes:
            raise ValueError("练习资源包中的训练信息无效")
        seen_ids.add(artifact_id)
        seen_modes.add(mode)
        artifact = get_artifact(artifact_id, user_id)
        if not artifact or artifact.get("kind") != "practice" or artifact.get("status") not in {"draft", "saved"}:
            raise ValueError("练习资源包中的训练已发生变化，请刷新后重新确认")
        pending.append((artifact, mode))

    if seen_modes != allowed_modes:
        raise ValueError("练习资源包需要包含同类题、变式题、专项训练、模拟试卷、编程实验和口述测验")

    saved: list[dict] = []
    for artifact, mode in pending:
        if artifact.get("status") == "draft":
            archived = save_artifact(
                artifact["id"], user_id, artifact["title"], course_name, topic_name, "separate",
            )
        else:
            archived = update_artifact_metadata(
                artifact["id"], user_id, artifact["title"], course_name, topic_name,
            )
        if not archived:
            raise ValueError("保存练习资源包时发生变化，请重新确认")
        execute(
            "UPDATE learning_artifacts SET practice_pack_id = %s, practice_pack_mode = %s, updated_at = NOW() "
            "WHERE id = %s AND user_id = %s",
            (pack_id, mode, archived["id"], user_id),
        )
        saved_artifact = get_artifact(archived["id"], user_id)
        if saved_artifact:
            saved.append(saved_artifact)
    return saved


def find_duplicate_artifacts(
    artifact_id: int,
    user_id: int,
    title: str,
    course_name: str,
    topic_name: str,
) -> list[dict]:
    existing = get_artifact(artifact_id, user_id)
    if not existing or existing.get("status") != "draft":
        return []
    course_name = _clean_name(course_name, "未分类课程")
    topic_name = _clean_name(topic_name, "未分类主题")
    paths = query(
        "SELECT c.id AS course_id, t.id AS topic_id FROM library_courses c "
        "JOIN library_topics t ON t.course_id = c.id AND t.user_id = c.user_id "
        "WHERE c.user_id = %s AND c.name = %s AND t.name = %s",
        (user_id, course_name, topic_name),
    )
    if not paths:
        return []
    course_id, topic_id = paths[0]["course_id"], paths[0]["topic_id"]
    rows = query(
        _ARTIFACT_SELECT
        + "WHERE a.user_id = %s AND a.course_id = %s AND a.topic_id = %s AND a.kind = %s "
        "AND a.status = 'saved' AND a.id <> %s AND a.version = ("
        "SELECT MAX(v.version) FROM learning_artifacts v WHERE v.user_id = a.user_id "
        "AND COALESCE(v.version_group_id, v.id) = COALESCE(a.version_group_id, a.id) "
        "AND v.status = 'saved') ORDER BY a.updated_at DESC",
        (user_id, course_id, topic_id, existing["kind"], artifact_id),
    )
    matches = []
    for row in rows:
        artifact = _row(row)
        similarity = _title_similarity(title, artifact["title"])
        if similarity >= 0.58:
            matches.append({**artifact, "similarity": round(similarity, 3)})
    return sorted(matches, key=lambda item: (item["similarity"], item["updated_at"]), reverse=True)[:3]


def list_artifact_versions(artifact_id: int, user_id: int) -> list[dict]:
    existing = get_artifact(artifact_id, user_id)
    if not existing:
        return []
    group_id = _version_group_id(existing)
    rows = query(
        _ARTIFACT_SELECT
        + "WHERE a.user_id = %s AND COALESCE(a.version_group_id, a.id) = %s "
        "AND a.status = %s ORDER BY a.version DESC, a.updated_at DESC",
        (user_id, group_id, existing["status"]),
    )
    return [_row(row) for row in rows]


def restore_artifact_version(artifact_id: int, user_id: int) -> dict | None:
    selected = get_artifact(artifact_id, user_id)
    if not selected or selected.get("status") != "saved":
        return None
    group_id = _version_group_id(selected)
    latest_rows = query(
        _ARTIFACT_SELECT
        + "WHERE a.user_id = %s AND COALESCE(a.version_group_id, a.id) = %s "
        "AND a.status = 'saved' ORDER BY a.version DESC LIMIT 1",
        (user_id, group_id),
    )
    if not latest_rows:
        return None
    latest = _row(latest_rows[0])
    new_id = insert("learning_artifacts", {
        "user_id": selected["user_id"],
        "session_id": selected["session_id"],
        "qa_id": selected["qa_id"],
        "kind": selected["kind"],
        "title": selected["title"],
        "summary": selected["summary"],
        "highlights": json.dumps(selected["highlights"], ensure_ascii=False),
        "content": selected["content"],
        "source_prompt": selected["source_prompt"],
        "purpose": selected["purpose"],
        "depth": selected["depth"],
        "style": selected["style"],
        "document_template": selected.get("document_template", "system_guide"),
        "course_id": selected["course_id"],
        "topic_id": selected["topic_id"],
        "recommended_course_name": selected["recommended_course_name"],
        "recommended_topic_name": selected["recommended_topic_name"],
        "classification_source": selected["classification_source"],
        "classification_confidence": selected["classification_confidence"],
        "classification_overridden": selected["classification_overridden"],
        "classification_keywords": json.dumps(selected["classification_keywords"], ensure_ascii=False),
        "source_map_artifact_id": selected.get("source_map_artifact_id"),
        "folder": "",
        "status": "saved",
        "version_group_id": group_id,
        "version": latest["version"] + 1,
        "is_favorite": latest["is_favorite"],
    })
    return get_artifact(new_id, user_id)


def update_artifact_metadata(
    artifact_id: int,
    user_id: int,
    title: str,
    course_name: str,
    topic_name: str,
) -> dict | None:
    existing = get_artifact(artifact_id, user_id)
    if not existing or existing.get("status") != "saved":
        return None
    course_name = _clean_name(course_name, "未分类课程")
    topic_name = _clean_name(topic_name, "未分类主题")
    course_id, topic_id = ensure_library_path(user_id, course_name, topic_name)
    path_changed = not _same_path(
        existing.get("course_name"),
        existing.get("topic_name"),
        course_name,
        topic_name,
    )
    overridden = not _same_path(
        existing.get("recommended_course_name"),
        existing.get("recommended_topic_name"),
        course_name,
        topic_name,
    )
    execute(
        "UPDATE learning_artifacts SET title = %s, course_id = %s, topic_id = %s, "
        "classification_overridden = %s, updated_at = NOW() WHERE id = %s AND user_id = %s",
        (title, course_id, topic_id, overridden, artifact_id, user_id),
    )
    if path_changed:
        _record_classification_feedback(existing, course_name, topic_name)
    return get_artifact(artifact_id, user_id)


def update_knowledge_map_content(artifact_id: int, user_id: int, content: str) -> dict | None:
    """Persist learner edits for either a draft or an archived knowledge map."""
    existing = get_artifact(artifact_id, user_id)
    if not existing or existing.get("kind") != "map" or existing.get("status") == "deleted":
        return None
    execute(
        "UPDATE learning_artifacts SET content = %s, updated_at = NOW() WHERE id = %s AND user_id = %s",
        (content, artifact_id, user_id),
    )
    return get_artifact(artifact_id, user_id)


def update_interactive_presentation_content(
    artifact_id: int,
    user_id: int,
    content: str,
    title: str,
    summary: str,
    highlights: list[str],
) -> dict | None:
    """Save an interactive presentation without overwriting an archived version.

    Drafts are still part of the active conversation and can be updated in place. Once an
    artifact lives in the library, an edit becomes the next version of that same artifact.
    """
    existing = get_artifact(artifact_id, user_id)
    if not existing or existing.get("kind") != "interactive" or existing.get("status") == "deleted":
        return None

    if existing.get("status") == "draft":
        execute(
            "UPDATE learning_artifacts SET title = %s, summary = %s, highlights = %s, content = %s, "
            "updated_at = NOW() WHERE id = %s AND user_id = %s AND status = 'draft'",
            (title, summary, json.dumps(highlights, ensure_ascii=False), content, artifact_id, user_id),
        )
        return get_artifact(artifact_id, user_id)

    if existing.get("status") != "saved":
        return None

    group_id = _version_group_id(existing)
    latest_rows = query(
        _ARTIFACT_SELECT
        + "WHERE a.user_id = %s AND COALESCE(a.version_group_id, a.id) = %s "
        "AND a.status = 'saved' ORDER BY a.version DESC, a.updated_at DESC LIMIT 1",
        (user_id, group_id),
    )
    if not latest_rows:
        return None
    latest = _row(latest_rows[0])
    new_id = insert("learning_artifacts", {
        "user_id": existing["user_id"],
        "session_id": existing["session_id"],
        "qa_id": existing["qa_id"],
        "kind": existing["kind"],
        "title": title,
        "summary": summary,
        "highlights": json.dumps(highlights, ensure_ascii=False),
        "content": content,
        "source_prompt": existing["source_prompt"],
        "purpose": existing["purpose"],
        "depth": existing["depth"],
        "style": existing["style"],
        "document_template": existing.get("document_template", "system_guide"),
        "course_id": existing["course_id"],
        "topic_id": existing["topic_id"],
        "recommended_course_name": existing["recommended_course_name"],
        "recommended_topic_name": existing["recommended_topic_name"],
        "classification_source": existing["classification_source"],
        "classification_confidence": existing["classification_confidence"],
        "classification_overridden": existing["classification_overridden"],
        "classification_keywords": json.dumps(existing["classification_keywords"], ensure_ascii=False),
        "source_map_artifact_id": existing.get("source_map_artifact_id"),
        "folder": "",
        "status": "saved",
        "version_group_id": group_id,
        "version": latest["version"] + 1,
        "is_favorite": latest["is_favorite"],
    })
    return get_artifact(new_id, user_id)


def set_artifact_favorite(artifact_id: int, user_id: int, favorite: bool) -> dict | None:
    existing = get_artifact(artifact_id, user_id)
    if not existing or existing.get("status") != "saved":
        return None
    execute(
        "UPDATE learning_artifacts SET is_favorite = %s, updated_at = NOW() WHERE id = %s AND user_id = %s",
        (favorite, artifact_id, user_id),
    )
    return get_artifact(artifact_id, user_id)


def trash_artifact(artifact_id: int, user_id: int) -> dict | None:
    existing = get_artifact(artifact_id, user_id)
    if not existing or existing.get("status") != "saved":
        return None
    group_id = _version_group_id(existing)
    execute(
        "UPDATE learning_artifacts SET status = 'deleted', deleted_at = NOW(), updated_at = NOW() "
        "WHERE user_id = %s AND COALESCE(version_group_id, id) = %s AND status = 'saved'",
        (user_id, group_id),
    )
    return get_artifact(artifact_id, user_id)


def restore_artifact(artifact_id: int, user_id: int) -> dict | None:
    existing = get_artifact(artifact_id, user_id)
    if not existing or existing.get("status") != "deleted":
        return None
    group_id = _version_group_id(existing)
    execute(
        "UPDATE learning_artifacts SET status = 'saved', deleted_at = NULL, updated_at = NOW() "
        "WHERE user_id = %s AND COALESCE(version_group_id, id) = %s AND status = 'deleted'",
        (user_id, group_id),
    )
    return get_artifact(artifact_id, user_id)


def permanently_delete_artifact(artifact_id: int, user_id: int) -> bool:
    existing = get_artifact(artifact_id, user_id)
    if not existing or existing.get("status") != "deleted":
        return False
    group_id = _version_group_id(existing)
    execute(
        "DELETE FROM learning_artifacts WHERE user_id = %s AND COALESCE(version_group_id, id) = %s "
        "AND status = 'deleted'",
        (user_id, group_id),
    )
    return True


def _normalize_name(value: str | None) -> str:
    return "".join(str(value or "").lower().split())


def _normalize_title(value: str | None) -> str:
    normalized = re.sub(r"[^\w\u4e00-\u9fff]+", "", str(value or "").lower())
    for suffix in ("学习文档", "学习资料", "讲义", "笔记", "详解", "解析"):
        normalized = normalized.removesuffix(suffix)
    return normalized


def _title_similarity(first: str | None, second: str | None) -> float:
    left, right = _normalize_title(first), _normalize_title(second)
    if not left or not right:
        return 0
    if left == right:
        return 1
    ratio = SequenceMatcher(None, left, right).ratio()
    if min(len(left), len(right)) >= 4 and (left in right or right in left):
        ratio = max(ratio, 0.88)
    return ratio


def _version_group_id(artifact: dict) -> int:
    return int(artifact.get("version_group_id") or artifact["id"])


def _same_path(
    first_course: str | None,
    first_topic: str | None,
    second_course: str | None,
    second_topic: str | None,
) -> bool:
    return (
        _normalize_name(first_course) == _normalize_name(second_course)
        and _normalize_name(first_topic) == _normalize_name(second_topic)
    )


def _feedback_keywords(artifact: dict) -> list[str]:
    values = [
        *(artifact.get("classification_keywords") or []),
        artifact.get("title", ""),
        artifact.get("source_prompt", ""),
    ]
    keywords: list[str] = []
    for value in values:
        cleaned = " ".join(str(value or "").strip().split())[:120]
        if cleaned and cleaned not in keywords:
            keywords.append(cleaned)
    return keywords[:12]


def _record_classification_feedback(artifact: dict, final_course_name: str, final_topic_name: str) -> None:
    recommended_course_name = artifact.get("recommended_course_name") or artifact.get("course_name") or "未分类课程"
    recommended_topic_name = artifact.get("recommended_topic_name") or artifact.get("topic_name") or "未分类主题"
    if _same_path(recommended_course_name, recommended_topic_name, final_course_name, final_topic_name):
        return
    insert("library_classification_feedback", {
        "user_id": artifact["user_id"],
        "artifact_id": artifact["id"],
        "recommended_course_name": recommended_course_name,
        "recommended_topic_name": recommended_topic_name,
        "final_course_name": _clean_name(final_course_name, "未分类课程"),
        "final_topic_name": _clean_name(final_topic_name, "未分类主题"),
        "keywords": json.dumps(_feedback_keywords(artifact), ensure_ascii=False),
    })


def _row(row: dict) -> dict:
    recommended_course_name = row.get("recommended_course_name") or row.get("course_name") or "未分类课程"
    recommended_topic_name = row.get("recommended_topic_name") or row.get("topic_name") or "未分类主题"
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
        "document_template": row.get("document_template", "system_guide"),
        "course_name": row.get("course_name") or recommended_course_name,
        "topic_name": row.get("topic_name") or recommended_topic_name,
        "recommended_course_name": recommended_course_name,
        "recommended_topic_name": recommended_topic_name,
        "classification_source": row.get("classification_source") or "fallback",
        "classification_confidence": float(row.get("classification_confidence") or 0),
        "classification_overridden": bool(row.get("classification_overridden", 0)),
        "classification_keywords": _json(row.get("classification_keywords"), []),
        "source_map_artifact_id": row.get("source_map_artifact_id"),
        "learning_loop_id": row.get("learning_loop_id") or "",
        "learning_loop_step": row.get("learning_loop_step") or "",
        "document_pack_id": row.get("document_pack_id") or "",
        "document_pack_template": row.get("document_pack_template") or "",
        "practice_pack_id": row.get("practice_pack_id") or "",
        "practice_pack_mode": row.get("practice_pack_mode") or "",
        "status": row.get("status", "draft"),
        "course_id": row.get("course_id"),
        "topic_id": row.get("topic_id"),
        "topic_mastery": int(row.get("topic_mastery") or 0),
        "version_group_id": int(row.get("version_group_id") or row["id"]),
        "version": int(row.get("version") or 1),
        "is_favorite": bool(row.get("is_favorite", 0)),
        "deleted_at": str(row.get("deleted_at", "")) if row.get("deleted_at") else "",
        "created_at": str(row.get("created_at", "")),
        "updated_at": str(row.get("updated_at", "")),
    }
