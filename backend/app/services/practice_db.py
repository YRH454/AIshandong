"""Persistent practice sets and attempts linked to learning-library artifacts."""

import json
import re

from app.database import _ensure_column, execute, insert, query


def _json(value, default):
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value or "")
    except (TypeError, json.JSONDecodeError):
        return default


def init_tables():
    execute("""
        CREATE TABLE IF NOT EXISTS practice_sets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            artifact_id INT NOT NULL UNIQUE,
            question_count INT NOT NULL,
            practice_mode VARCHAR(32) NOT NULL DEFAULT 'standard',
            estimated_minutes INT NOT NULL DEFAULT 8,
            knowledge_points JSON NOT NULL,
            questions JSON NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    """)
    _ensure_column("practice_sets", "practice_mode", "VARCHAR(32) NOT NULL DEFAULT 'standard'")
    _ensure_column("practice_sets", "estimated_minutes", "INT NOT NULL DEFAULT 8")
    execute("""
        CREATE TABLE IF NOT EXISTS practice_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            practice_set_id INT NOT NULL,
            answers JSON NOT NULL,
            correct_count INT NOT NULL,
            total_count INT NOT NULL,
            score INT NOT NULL,
            weak_points JSON NOT NULL,
            completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)


def create_practice_set(
    user_id: int,
    artifact_id: int,
    questions: list[dict],
    knowledge_points: list[str],
    practice_mode: str = "standard",
    estimated_minutes: int = 8,
) -> dict:
    practice_set_id = insert("practice_sets", {
        "user_id": user_id,
        "artifact_id": artifact_id,
        "question_count": len(questions),
        "practice_mode": practice_mode,
        "estimated_minutes": estimated_minutes,
        "knowledge_points": json.dumps(knowledge_points, ensure_ascii=False),
        "questions": json.dumps(questions, ensure_ascii=False),
    })
    return get_practice_set(practice_set_id, user_id, include_answers=True) or {}


def get_practice_set(practice_set_id: int, user_id: int, *, include_answers: bool = False) -> dict | None:
    rows = query(
        "SELECT * FROM practice_sets WHERE id = %s AND user_id = %s",
        (practice_set_id, user_id),
    )
    if not rows:
        return None
    return _practice_row(rows[0], include_answers=include_answers)


def get_practice_for_artifact(artifact_id: int, user_id: int) -> dict | None:
    rows = query(
        "SELECT * FROM practice_sets WHERE artifact_id = %s AND user_id = %s",
        (artifact_id, user_id),
    )
    if not rows:
        return None
    return _practice_row(rows[0], include_answers=False)


def submit_attempt(practice_set_id: int, user_id: int, answers: dict[str, str]) -> dict | None:
    practice_set = get_practice_set(practice_set_id, user_id, include_answers=True)
    if not practice_set:
        return None
    normalized_answers = {str(key): str(value or "").strip() for key, value in (answers or {}).items()}
    results: list[dict] = []
    weak_points: list[str] = []
    correct_count = 0
    for item in practice_set["questions"]:
        given = normalized_answers.get(item["id"], "")
        correct = _is_correct(item, given)
        if correct:
            correct_count += 1
        else:
            point = item.get("knowledge_point") or "当前知识点"
            if point not in weak_points:
                weak_points.append(point)
        results.append({
            "question_id": item["id"],
            "answer": given,
            "correct": correct,
            "correct_answer": item["answer"],
            "explanation": item["explanation"],
            "knowledge_point": item.get("knowledge_point") or "当前知识点",
        })
    total_count = len(practice_set["questions"])
    score = round(correct_count / total_count * 100) if total_count else 0
    attempt_id = insert("practice_attempts", {
        "user_id": user_id,
        "practice_set_id": practice_set_id,
        "answers": json.dumps(normalized_answers, ensure_ascii=False),
        "correct_count": correct_count,
        "total_count": total_count,
        "score": score,
        "weak_points": json.dumps(weak_points, ensure_ascii=False),
    })
    topic_mastery = refresh_topic_mastery_for_artifact(practice_set["artifact_id"], user_id)
    return {
        "artifact_id": practice_set["artifact_id"],
        "attempt": {
            "id": attempt_id,
            "practice_set_id": practice_set_id,
            "correct_count": correct_count,
            "total_count": total_count,
            "score": score,
            "weak_points": weak_points,
            "results": results,
        },
        "topic_mastery": topic_mastery,
    }


def list_attempts_for_artifact(artifact_id: int, user_id: int) -> list[dict]:
    rows = query(
        "SELECT pa.* FROM practice_attempts pa JOIN practice_sets ps ON ps.id = pa.practice_set_id "
        "WHERE ps.artifact_id = %s AND pa.user_id = %s ORDER BY pa.completed_at DESC",
        (artifact_id, user_id),
    )
    return [
        {
            "id": row["id"],
            "correct_count": row["correct_count"],
            "total_count": row["total_count"],
            "score": row["score"],
            "weak_points": _json(row.get("weak_points"), []),
            "completed_at": str(row.get("completed_at") or ""),
        }
        for row in rows
    ]


def get_practice_map_context(practice_set_id: int, user_id: int) -> dict | None:
    rows = query(
        "SELECT ps.knowledge_points, a.source_map_artifact_id FROM practice_sets ps "
        "JOIN learning_artifacts a ON a.id = ps.artifact_id "
        "WHERE ps.id = %s AND ps.user_id = %s",
        (practice_set_id, user_id),
    )
    if not rows or not rows[0].get("source_map_artifact_id"):
        return None
    return {
        "map_artifact_id": int(rows[0]["source_map_artifact_id"]),
        "knowledge_points": _json(rows[0].get("knowledge_points"), []),
    }


def list_topic_reviews(user_id: int) -> list[dict]:
    """Return the visible review state for every saved library topic."""
    topic_rows = query(
        "SELECT c.name AS course_name, t.name AS topic_name, t.mastery "
        "FROM library_topics t JOIN library_courses c ON c.id = t.course_id "
        "WHERE t.user_id = %s AND EXISTS ("
        "SELECT 1 FROM learning_artifacts a WHERE a.user_id = t.user_id "
        "AND a.topic_id = t.id AND a.status = 'saved') "
        "ORDER BY c.name, t.name",
        (user_id,),
    )
    reviews: dict[tuple[str, str], dict] = {
        (str(row["course_name"]), str(row["topic_name"])): {
            "course_name": str(row["course_name"]),
            "topic_name": str(row["topic_name"]),
            "mastery": int(row.get("mastery") or 0),
            "recent_score": None,
            "recent_completed_at": "",
            "attempt_count": 0,
            "weak_points": [],
            "wrong_questions": [],
        }
        for row in topic_rows
    }
    attempt_rows = query(
        "SELECT c.name AS course_name, t.name AS topic_name, pa.score, pa.weak_points, pa.answers, pa.completed_at, ps.questions "
        "FROM practice_attempts pa "
        "JOIN practice_sets ps ON ps.id = pa.practice_set_id "
        "JOIN learning_artifacts a ON a.id = ps.artifact_id "
        "JOIN library_topics t ON t.id = a.topic_id "
        "JOIN library_courses c ON c.id = a.course_id "
        "WHERE pa.user_id = %s AND a.user_id = %s AND a.status = 'saved' "
        "ORDER BY pa.completed_at DESC",
        (user_id, user_id),
    )
    attempt_indexes: dict[tuple[str, str], int] = {}
    for row in attempt_rows:
        key = (str(row["course_name"]), str(row["topic_name"]))
        review = reviews.get(key)
        if not review:
            continue
        attempt_index = attempt_indexes.get(key, 0)
        attempt_indexes[key] = attempt_index + 1
        review["attempt_count"] += 1
        if attempt_index == 0:
            review["recent_score"] = int(row.get("score") or 0)
            review["recent_completed_at"] = str(row.get("completed_at") or "")
        if attempt_index < 3 and len(review["wrong_questions"]) < 3:
            for point in _json(row.get("weak_points"), []):
                point = str(point or "").strip()
                if point and point not in review["weak_points"]:
                    review["weak_points"].append(point)
            answers = _json(row.get("answers"), {})
            for question in _json(row.get("questions"), []):
                question_id = str(question.get("id") or "")
                given_answer = str((answers or {}).get(question_id, "")).strip()
                prompt = str(question.get("prompt") or "").strip()
                if not prompt or _is_correct(question, given_answer):
                    continue
                if any(item["prompt"] == prompt for item in review["wrong_questions"]):
                    continue
                review["wrong_questions"].append({
                    "prompt": prompt,
                    "knowledge_point": str(question.get("knowledge_point") or "当前知识点"),
                    "answer": given_answer,
                    "correct_answer": str(question.get("answer") or ""),
                    "explanation": str(question.get("explanation") or ""),
                    "completed_at": str(row.get("completed_at") or ""),
                })
                if len(review["wrong_questions"]) >= 3:
                    break
    return list(reviews.values())


def refresh_topic_mastery_for_artifact(artifact_id: int, user_id: int) -> int | None:
    artifact_rows = query(
        "SELECT course_id, topic_id, status FROM learning_artifacts WHERE id = %s AND user_id = %s",
        (artifact_id, user_id),
    )
    if not artifact_rows or artifact_rows[0].get("status") != "saved" or not artifact_rows[0].get("topic_id"):
        return None
    topic_id = artifact_rows[0]["topic_id"]
    scores = query(
        "SELECT pa.score FROM practice_attempts pa JOIN practice_sets ps ON ps.id = pa.practice_set_id "
        "JOIN learning_artifacts a ON a.id = ps.artifact_id "
        "WHERE pa.user_id = %s AND a.topic_id = %s AND a.status = 'saved' "
        "ORDER BY pa.completed_at DESC LIMIT 3",
        (user_id, topic_id),
    )
    if not scores:
        return None
    mastery = round(sum(int(row.get("score") or 0) for row in scores) / len(scores))
    execute("UPDATE library_topics SET mastery = %s WHERE id = %s AND user_id = %s", (mastery, topic_id, user_id))
    return mastery


def _practice_row(row: dict, *, include_answers: bool) -> dict:
    questions = _json(row.get("questions"), [])
    return {
        "id": row["id"],
        "artifact_id": row["artifact_id"],
        "question_count": int(row.get("question_count") or len(questions)),
        "practice_mode": str(row.get("practice_mode") or "standard"),
        "estimated_minutes": int(row.get("estimated_minutes") or 8),
        "knowledge_points": _json(row.get("knowledge_points"), []),
        "questions": [_public_question(item, include_answers=include_answers) for item in questions],
        "created_at": str(row.get("created_at") or ""),
        "updated_at": str(row.get("updated_at") or ""),
    }


def _public_question(item: dict, *, include_answers: bool) -> dict:
    result = {
        "id": item.get("id"),
        "type": item.get("type"),
        "prompt": item.get("prompt"),
        "options": item.get("options") or [],
        "knowledge_point": item.get("knowledge_point") or "当前知识点",
        "language": item.get("language") or "",
        "starter_code": item.get("starter_code") or "",
        "tests": item.get("tests") or [],
        "hints": item.get("hints") or [],
        "target_keywords": item.get("target_keywords") or [],
        "follow_up": item.get("follow_up") or "",
    }
    if include_answers:
        result.update({
            "answer": item.get("answer", ""),
            "accepted_answers": item.get("accepted_answers") or [item.get("answer", "")],
            "explanation": item.get("explanation", ""),
        })
    return result


def _normalize(value: str) -> str:
    return re.sub(r"[\s\W_]+", "", str(value or "").lower())


def _is_correct(question: dict, answer: str) -> bool:
    if question.get("type") == "code_task":
        return _normalize(answer) in {"完成", "已完成", "done", "complete"}
    if question.get("type") == "oral_response":
        keywords = [_normalize(item) for item in question.get("target_keywords", []) if _normalize(item)]
        normalized_answer = _normalize(answer)
        if not normalized_answer or not keywords:
            return False
        required = 1 if len(keywords) <= 2 else 2
        return sum(keyword in normalized_answer for keyword in keywords) >= required
    if question.get("type") == "fill_blank":
        accepted = question.get("accepted_answers") or [question.get("answer", "")]
        normalized_answer = _normalize(answer)
        return bool(normalized_answer) and any(normalized_answer == _normalize(item) for item in accepted)
    return _normalize(answer) == _normalize(question.get("answer", ""))
