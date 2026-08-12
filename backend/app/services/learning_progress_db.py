"""Topic-level learning state shared by every present and future material type."""

import json
import re

from app.database import execute, insert, query


def _json(value, default):
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value or "")
    except (TypeError, json.JSONDecodeError):
        return default


def init_tables():
    execute("""
        CREATE TABLE IF NOT EXISTS learning_topic_states (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            topic_id INT NOT NULL,
            active_artifact_id INT,
            last_activity_type VARCHAR(48) DEFAULT '',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE(user_id, topic_id)
        )
    """)
    execute("""
        CREATE TABLE IF NOT EXISTS learning_activities (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            course_id INT NOT NULL,
            topic_id INT NOT NULL,
            artifact_id INT,
            activity_type VARCHAR(48) NOT NULL,
            activity_data JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    execute("""
        CREATE TABLE IF NOT EXISTS interactive_presentation_progress (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            artifact_id INT NOT NULL,
            active_scene_id VARCHAR(80) NOT NULL DEFAULT '',
            completed_scene_ids JSON NOT NULL,
            is_completed TINYINT NOT NULL DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE(user_id, artifact_id)
        )
    """)


def _safe_action(action: str) -> str:
    normalized = re.sub(r"[^a-z0-9_]", "_", str(action or "").lower()).strip("_")
    return normalized[:48] or "opened"


def _artifact_context(artifact_id: int, user_id: int) -> dict | None:
    rows = query(
        "SELECT a.id, a.course_id, a.topic_id, c.name AS course_name, t.name AS topic_name "
        "FROM learning_artifacts a "
        "JOIN library_courses c ON c.id = a.course_id "
        "JOIN library_topics t ON t.id = a.topic_id "
        "WHERE a.id = %s AND a.user_id = %s AND a.status = 'saved'",
        (artifact_id, user_id),
    )
    return rows[0] if rows else None


def record_learning_activity(
    user_id: int,
    artifact_id: int,
    activity_type: str,
    activity_data: dict | None = None,
) -> dict | None:
    """Record an extensible learning event and move the topic's resume point."""
    context = _artifact_context(artifact_id, user_id)
    if not context:
        return None
    action = _safe_action(activity_type)
    payload = activity_data if isinstance(activity_data, dict) else {}
    insert("learning_activities", {
        "user_id": user_id,
        "course_id": context["course_id"],
        "topic_id": context["topic_id"],
        "artifact_id": artifact_id,
        "activity_type": action,
        "activity_data": json.dumps(payload, ensure_ascii=False),
    })
    state_rows = query(
        "SELECT id FROM learning_topic_states WHERE user_id = %s AND topic_id = %s",
        (user_id, context["topic_id"]),
    )
    if state_rows:
        execute(
            "UPDATE learning_topic_states SET active_artifact_id = %s, last_activity_type = %s, updated_at = NOW() "
            "WHERE id = %s",
            (artifact_id, action, state_rows[0]["id"]),
        )
    else:
        insert("learning_topic_states", {
            "user_id": user_id,
            "topic_id": context["topic_id"],
            "active_artifact_id": artifact_id,
            "last_activity_type": action,
        })
    return {
        "course_name": str(context["course_name"]),
        "topic_name": str(context["topic_name"]),
        "artifact_id": int(artifact_id),
        "activity_type": action,
    }


def _topic_artifacts(user_id: int, topic_id: int) -> list[dict]:
    return query(
        "SELECT a.id, a.kind, a.title, a.summary, a.content, a.updated_at "
        "FROM learning_artifacts a WHERE a.user_id = %s AND a.topic_id = %s AND a.status = 'saved' "
        "AND a.version = (SELECT MAX(v.version) FROM learning_artifacts v "
        "WHERE v.user_id = a.user_id AND COALESCE(v.version_group_id, v.id) = "
        "COALESCE(a.version_group_id, a.id) AND v.status = 'saved') "
        "ORDER BY a.updated_at DESC",
        (user_id, topic_id),
    )


def _interactive_scene_ids(content: object) -> list[str]:
    presentation = _json(content, {})
    scenes = presentation.get("scenes", []) if isinstance(presentation, dict) else []
    if not isinstance(scenes, list):
        return []
    return [
        str(scene.get("id") or "").strip()[:80]
        for scene in scenes
        if isinstance(scene, dict) and str(scene.get("id") or "").strip()
    ]


def _interactive_check_scene_ids(content: object) -> set[str]:
    presentation = _json(content, {})
    scenes = presentation.get("scenes", []) if isinstance(presentation, dict) else []
    if not isinstance(scenes, list):
        return set()
    return {
        str(scene.get("id") or "").strip()[:80]
        for scene in scenes
        if isinstance(scene, dict) and isinstance(scene.get("check"), dict) and str(scene.get("id") or "").strip()
    }


def _interactive_checkpoints(artifact_id: int, user_id: int, check_scene_ids: set[str]) -> dict[str, dict]:
    if not check_scene_ids:
        return {}
    rows = query(
        "SELECT activity_data FROM learning_activities WHERE user_id = %s AND artifact_id = %s "
        "AND activity_type = 'scene_check_answered' ORDER BY created_at ASC LIMIT 120",
        (user_id, artifact_id),
    )
    checkpoints: dict[str, dict] = {}
    for row in rows:
        payload = _json(row.get("activity_data"), {})
        if not isinstance(payload, dict):
            continue
        scene_id = str(payload.get("scene_id") or "").strip()[:80]
        if scene_id not in check_scene_ids:
            continue
        current = checkpoints.setdefault(scene_id, {"attempts": 0, "correct": False, "last_answer": ""})
        current["attempts"] += 1
        current["correct"] = bool(payload.get("correct"))
        current["last_answer"] = _clean_answer(payload.get("answer"))
    return checkpoints


def _clean_answer(value: object) -> str:
    return str(value or "").strip()[:120]


def _interactive_artifact(artifact_id: int, user_id: int) -> dict | None:
    rows = query(
        "SELECT id, content FROM learning_artifacts "
        "WHERE id = %s AND user_id = %s AND kind = 'interactive' AND status = 'saved'",
        (artifact_id, user_id),
    )
    return rows[0] if rows else None


def get_interactive_presentation_progress(artifact_id: int, user_id: int) -> dict | None:
    artifact = _interactive_artifact(artifact_id, user_id)
    if not artifact:
        return None
    scene_ids = _interactive_scene_ids(artifact.get("content"))
    check_scene_ids = _interactive_check_scene_ids(artifact.get("content"))
    rows = query(
        "SELECT active_scene_id, completed_scene_ids, is_completed, updated_at "
        "FROM interactive_presentation_progress WHERE user_id = %s AND artifact_id = %s",
        (user_id, artifact_id),
    )
    row = rows[0] if rows else {}
    completed_ids = [
        scene_id for scene_id in _json(row.get("completed_scene_ids"), [])
        if isinstance(scene_id, str) and scene_id in scene_ids
    ]
    active_scene_id = str(row.get("active_scene_id") or "")
    if active_scene_id not in scene_ids:
        active_scene_id = scene_ids[0] if scene_ids else ""
    return {
        "artifact_id": int(artifact_id),
        "active_scene_id": active_scene_id,
        "completed_scene_ids": list(dict.fromkeys(completed_ids)),
        "is_completed": bool(row.get("is_completed")) and bool(scene_ids) and len(set(completed_ids)) == len(scene_ids),
        "checkpoints": _interactive_checkpoints(artifact_id, user_id, check_scene_ids),
        "updated_at": str(row.get("updated_at") or ""),
    }


def update_interactive_presentation_progress(
    artifact_id: int,
    user_id: int,
    active_scene_id: str,
    completed_scene_ids: list[str],
    is_completed: bool,
) -> dict | None:
    artifact = _interactive_artifact(artifact_id, user_id)
    if not artifact:
        return None
    scene_ids = _interactive_scene_ids(artifact.get("content"))
    if not scene_ids:
        return None
    active = str(active_scene_id or "").strip()[:80]
    if active not in scene_ids:
        active = scene_ids[0]
    completed = [
        scene_id for scene_id in completed_scene_ids
        if isinstance(scene_id, str) and scene_id in scene_ids
    ]
    completed = list(dict.fromkeys(completed))
    completed_all = bool(is_completed) and len(completed) == len(scene_ids)
    rows = query(
        "SELECT id FROM interactive_presentation_progress WHERE user_id = %s AND artifact_id = %s",
        (user_id, artifact_id),
    )
    if rows:
        execute(
            "UPDATE interactive_presentation_progress SET active_scene_id = %s, completed_scene_ids = %s, "
            "is_completed = %s, updated_at = NOW() WHERE id = %s",
            (active, json.dumps(completed, ensure_ascii=False), completed_all, rows[0]["id"]),
        )
    else:
        insert("interactive_presentation_progress", {
            "user_id": user_id,
            "artifact_id": artifact_id,
            "active_scene_id": active,
            "completed_scene_ids": json.dumps(completed, ensure_ascii=False),
            "is_completed": completed_all,
        })
    record_learning_activity(
        user_id,
        artifact_id,
        "scene_progressed",
        {"scene_id": active, "completed_scene_count": len(completed), "is_completed": completed_all},
    )
    return get_interactive_presentation_progress(artifact_id, user_id)


def record_interactive_presentation_checkpoint(
    artifact_id: int,
    user_id: int,
    scene_id: str,
    answer: str,
) -> dict | None:
    """Persist one in-presentation check without trusting a client-side score."""
    artifact = _interactive_artifact(artifact_id, user_id)
    if not artifact:
        return None
    presentation = _json(artifact.get("content"), {})
    scenes = presentation.get("scenes", []) if isinstance(presentation, dict) else []
    normalized_scene_id = str(scene_id or "").strip()[:80]
    selected_scene = next(
        (scene for scene in scenes if isinstance(scene, dict) and str(scene.get("id") or "").strip() == normalized_scene_id),
        None,
    )
    check = selected_scene.get("check") if isinstance(selected_scene, dict) else None
    if not isinstance(check, dict):
        return None
    selected_answer = _clean_answer(answer)
    correct = selected_answer == _clean_answer(check.get("answer"))
    record_learning_activity(
        user_id,
        artifact_id,
        "scene_check_answered",
        {"scene_id": normalized_scene_id, "answer": selected_answer, "correct": correct},
    )
    return get_interactive_presentation_progress(artifact_id, user_id)


def _interactive_progress(user_id: int, dynamic_explanations: list[dict]) -> tuple[dict, dict[int, dict]]:
    summary = {
        "presentations": len(dynamic_explanations),
        "scenes": 0,
        "completed_scenes": 0,
        "completed_presentations": 0,
        "in_progress": 0,
        "checks": 0,
        "confirmed_checks": 0,
    }
    by_artifact: dict[int, dict] = {}
    for artifact in dynamic_explanations:
        artifact_id = int(artifact["id"])
        scene_ids = _interactive_scene_ids(artifact.get("content"))
        check_scene_ids = _interactive_check_scene_ids(artifact.get("content"))
        rows = query(
            "SELECT active_scene_id, completed_scene_ids, is_completed FROM interactive_presentation_progress "
            "WHERE user_id = %s AND artifact_id = %s",
            (user_id, artifact_id),
        )
        row = rows[0] if rows else {}
        completed_ids = [
            scene_id for scene_id in _json(row.get("completed_scene_ids"), [])
            if isinstance(scene_id, str) and scene_id in scene_ids
        ]
        completed_ids = list(dict.fromkeys(completed_ids))
        is_completed = bool(row.get("is_completed")) and bool(scene_ids) and len(completed_ids) == len(scene_ids)
        checkpoints = _interactive_checkpoints(artifact_id, user_id, check_scene_ids)
        active_scene_id = str(row.get("active_scene_id") or "")
        if active_scene_id not in scene_ids:
            active_scene_id = scene_ids[0] if scene_ids else ""
        current = {
            "total": len(scene_ids),
            "completed": len(completed_ids),
            "active_scene_id": active_scene_id,
            "is_completed": is_completed,
            "has_progress": bool(rows),
            "checks": len(check_scene_ids),
            "confirmed_checks": sum(1 for item in checkpoints.values() if item.get("correct")),
        }
        by_artifact[artifact_id] = current
        summary["scenes"] += current["total"]
        summary["completed_scenes"] += current["completed"]
        summary["completed_presentations"] += int(is_completed)
        summary["in_progress"] += int(current["has_progress"] and not is_completed)
        summary["checks"] += current["checks"]
        summary["confirmed_checks"] += current["confirmed_checks"]
    return summary, by_artifact


def _map_progress(user_id: int, maps: list[dict]) -> tuple[dict, dict[int, dict]]:
    summary = {"total": 0, "mastered": 0, "review": 0, "untouched": 0}
    by_artifact: dict[int, dict] = {}
    for artifact in maps:
        try:
            content = _json(artifact.get("content"), {})
            nodes = content.get("nodes", []) if isinstance(content, dict) else []
            total = len(nodes) if isinstance(nodes, list) else 0
        except (AttributeError, TypeError):
            total = 0
        rows = query(
            "SELECT status, COUNT(*) AS count FROM knowledge_map_node_progress "
            "WHERE user_id = %s AND artifact_id = %s GROUP BY status",
            (user_id, artifact["id"]),
        )
        statuses = {str(row["status"]): int(row.get("count") or 0) for row in rows}
        mastered = statuses.get("mastered", 0)
        review = statuses.get("review", 0)
        current = {
            "total": total,
            "mastered": mastered,
            "review": review,
            "untouched": max(0, total - mastered - review),
        }
        by_artifact[int(artifact["id"])] = current
        for key in summary:
            summary[key] += current[key]
    return summary, by_artifact


def _practice_summary(user_id: int, topic_id: int) -> dict:
    rows = query(
        "SELECT pa.score, pa.weak_points, pa.completed_at FROM practice_attempts pa "
        "JOIN practice_sets ps ON ps.id = pa.practice_set_id "
        "JOIN learning_artifacts a ON a.id = ps.artifact_id "
        "WHERE pa.user_id = %s AND a.user_id = %s AND a.topic_id = %s AND a.status = 'saved' "
        "ORDER BY pa.completed_at DESC",
        (user_id, user_id, topic_id),
    )
    weak_points: list[str] = []
    for row in rows[:3]:
        for point in _json(row.get("weak_points"), []):
            clean = str(point or "").strip()
            if clean and clean not in weak_points:
                weak_points.append(clean)
    latest = rows[0] if rows else None
    return {
        "attempt_count": len(rows),
        "recent_score": int(latest.get("score") or 0) if latest else None,
        "recent_completed_at": str(latest.get("completed_at") or "") if latest else "",
        "weak_points": weak_points[:5],
    }


def get_topic_learning_state(user_id: int, course_name: str, topic_name: str) -> dict | None:
    rows = query(
        "SELECT t.id AS topic_id, t.mastery, c.name AS course_name, t.name AS topic_name "
        "FROM library_topics t JOIN library_courses c ON c.id = t.course_id "
        "WHERE t.user_id = %s AND c.name = %s AND t.name = %s",
        (user_id, course_name, topic_name),
    )
    if not rows:
        return None
    topic = rows[0]
    artifacts = _topic_artifacts(user_id, topic["topic_id"])
    state_rows = query(
        "SELECT active_artifact_id, last_activity_type, updated_at FROM learning_topic_states "
        "WHERE user_id = %s AND topic_id = %s",
        (user_id, topic["topic_id"]),
    )
    activities = query(
        "SELECT artifact_id, activity_type, created_at FROM learning_activities "
        "WHERE user_id = %s AND topic_id = %s ORDER BY created_at DESC LIMIT 120",
        (user_id, topic["topic_id"]),
    )
    opened_ids = {
        int(row["artifact_id"]) for row in activities
        if row.get("artifact_id") and row.get("activity_type") in {"opened", "scene_started", "scene_progressed", "scene_check_answered"}
    }
    completed_ids = {
        int(row["artifact_id"]) for row in activities
        if row.get("artifact_id") and row.get("activity_type") in {"completed", "practice_submitted"}
    }
    maps = [artifact for artifact in artifacts if artifact.get("kind") == "map"]
    practices = [artifact for artifact in artifacts if artifact.get("kind") == "practice"]
    dynamic_explanations = [artifact for artifact in artifacts if artifact.get("kind") == "interactive"]
    map_summary, map_by_artifact = _map_progress(user_id, maps)
    interactive_summary, interactive_by_artifact = _interactive_progress(user_id, dynamic_explanations)
    practice = _practice_summary(user_id, topic["topic_id"])
    state = state_rows[0] if state_rows else {}
    recommendation = _recommend_next_step(
        artifacts,
        maps,
        practices,
        dynamic_explanations,
        map_by_artifact,
        interactive_by_artifact,
        practice,
        opened_ids,
        completed_ids,
        state.get("active_artifact_id"),
    )
    last_activity = activities[0] if activities else None
    return {
        "course_name": str(topic["course_name"]),
        "topic_name": str(topic["topic_name"]),
        "mastery": int(topic.get("mastery") or 0),
        "materials": {
            "total": len(artifacts),
            "opened": len(opened_ids & {int(artifact["id"]) for artifact in artifacts}),
            "completed": len(completed_ids & {int(artifact["id"]) for artifact in artifacts}),
        },
        "map_progress": map_summary,
        "interactive": interactive_summary,
        "practice": practice,
        "active_artifact_id": state.get("active_artifact_id"),
        "last_activity": {
            "type": state.get("last_activity_type") or (last_activity or {}).get("activity_type") or "",
            "at": str(state.get("updated_at") or (last_activity or {}).get("created_at") or ""),
        },
        "next_step": recommendation,
    }


def _recommend_next_step(
    artifacts: list[dict],
    maps: list[dict],
    practices: list[dict],
    dynamic_explanations: list[dict],
    map_by_artifact: dict[int, dict],
    interactive_by_artifact: dict[int, dict],
    practice: dict,
    opened_ids: set[int],
    completed_ids: set[int],
    active_artifact_id: object,
) -> dict:
    def step(action: str, artifact: dict | None = None, detail: str = "") -> dict:
        return {
            "action": action,
            "artifact_id": int(artifact["id"]) if artifact else None,
            "detail": detail,
        }

    active_explanation = next(
        (
            item for item in dynamic_explanations
            if int(item["id"]) == int(active_artifact_id or 0)
            and interactive_by_artifact.get(int(item["id"]), {}).get("has_progress")
            and not interactive_by_artifact.get(int(item["id"]), {}).get("is_completed")
        ),
        None,
    )
    unfinished_explanation = active_explanation or next(
        (
            item for item in dynamic_explanations
            if interactive_by_artifact.get(int(item["id"]), {}).get("has_progress")
            and not interactive_by_artifact.get(int(item["id"]), {}).get("is_completed")
        ),
        None,
    )
    if not unfinished_explanation:
        unfinished_explanation = next(
            (
                item for item in dynamic_explanations
                if int(item["id"]) in opened_ids and int(item["id"]) not in completed_ids
            ),
            None,
        )
    if unfinished_explanation:
        return step("continue_explanation", unfinished_explanation, "继续完成这份动态讲解，并在途中完成理解检查。")
    review_map = next((item for item in maps if map_by_artifact.get(int(item["id"]), {}).get("review", 0) > 0), None)
    if review_map:
        return step("review_map", review_map, "先复习标记为待复习的图解节点。")
    unopened = next((item for item in artifacts if int(item["id"]) not in opened_ids and item.get("kind") != "practice"), None)
    if unopened:
        return step("open_material", unopened, "先建立这个主题的核心理解。")
    unfinished_map = next((item for item in maps if map_by_artifact.get(int(item["id"]), {}).get("untouched", 0) > 0), None)
    if unfinished_map:
        return step("continue_map", unfinished_map, "继续梳理还没有标记的知识节点。")
    if practice.get("recent_score") is not None and practice["recent_score"] < 80 and practice.get("weak_points") and practices:
        return step("practice_weak_points", practices[0], "围绕最近的薄弱点再练一次。")
    if practices and not practice.get("attempt_count"):
        return step("start_practice", practices[0], "用一组练习检查是否真的理解。")
    if artifacts:
        return step("review_material", artifacts[0], "回看重点，并把掌握不牢的地方标出来。")
    return step("complete", None, "这个主题还没有保存的学习资料。")
