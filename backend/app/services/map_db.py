"""Persistent learning progress for interactive knowledge maps."""

import json
import re

from app.database import execute, insert, query


_STATUSES = {"review", "mastered"}


def init_tables():
    execute("""
        CREATE TABLE IF NOT EXISTS knowledge_map_node_progress (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            artifact_id INT NOT NULL,
            node_id VARCHAR(80) NOT NULL,
            status VARCHAR(20) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, artifact_id, node_id)
        )
    """)


def _map_nodes(artifact_id: int, user_id: int) -> list[dict] | None:
    rows = query(
        "SELECT kind, status, content FROM learning_artifacts WHERE id = %s AND user_id = %s",
        (artifact_id, user_id),
    )
    if not rows or rows[0].get("kind") != "map" or rows[0].get("status") == "deleted":
        return None
    try:
        payload = json.loads(rows[0].get("content") or "{}")
    except (TypeError, json.JSONDecodeError):
        return []
    nodes = payload.get("nodes") if isinstance(payload, dict) else []
    if not isinstance(nodes, list):
        return []
    return [
        {"id": str(node.get("id") or "").strip(), "label": str(node.get("label") or "").strip()}
        for node in nodes
        if isinstance(node, dict) and str(node.get("id") or "").strip()
    ]


def _progress_rows(artifact_id: int, user_id: int) -> dict[str, str]:
    rows = query(
        "SELECT node_id, status FROM knowledge_map_node_progress "
        "WHERE artifact_id = %s AND user_id = %s",
        (artifact_id, user_id),
    )
    return {
        str(row.get("node_id") or ""): str(row.get("status") or "")
        for row in rows
        if str(row.get("status") or "") in _STATUSES
    }


def get_map_progress(artifact_id: int, user_id: int) -> dict | None:
    nodes = _map_nodes(artifact_id, user_id)
    if nodes is None:
        return None
    valid_ids = {node["id"] for node in nodes}
    progress = {node_id: status for node_id, status in _progress_rows(artifact_id, user_id).items() if node_id in valid_ids}
    mastered = sum(status == "mastered" for status in progress.values())
    review = sum(status == "review" for status in progress.values())
    return {
        "progress": progress,
        "summary": {
            "total": len(nodes),
            "mastered": mastered,
            "review": review,
            "untouched": max(0, len(nodes) - mastered - review),
        },
    }


def set_map_node_progress(artifact_id: int, user_id: int, node_id: str, status: str) -> dict | None:
    nodes = _map_nodes(artifact_id, user_id)
    if nodes is None or node_id not in {node["id"] for node in nodes}:
        return None
    if status == "new":
        execute(
            "DELETE FROM knowledge_map_node_progress WHERE artifact_id = %s AND user_id = %s AND node_id = %s",
            (artifact_id, user_id, node_id),
        )
        return get_map_progress(artifact_id, user_id)
    if status not in _STATUSES:
        return None
    existing = query(
        "SELECT id FROM knowledge_map_node_progress WHERE artifact_id = %s AND user_id = %s AND node_id = %s",
        (artifact_id, user_id, node_id),
    )
    if existing:
        execute(
            "UPDATE knowledge_map_node_progress SET status = %s, updated_at = NOW() WHERE id = %s",
            (status, existing[0]["id"]),
        )
    else:
        insert("knowledge_map_node_progress", {
            "user_id": user_id,
            "artifact_id": artifact_id,
            "node_id": node_id,
            "status": status,
        })
    return get_map_progress(artifact_id, user_id)


def clear_map_progress(artifact_id: int, user_id: int) -> None:
    execute(
        "DELETE FROM knowledge_map_node_progress WHERE artifact_id = %s AND user_id = %s",
        (artifact_id, user_id),
    )


def prune_map_progress(artifact_id: int, user_id: int) -> dict | None:
    """Drop progress rows for nodes removed from an edited canvas."""
    nodes = _map_nodes(artifact_id, user_id)
    if nodes is None:
        return None
    valid_ids = {node["id"] for node in nodes}
    for node_id in _progress_rows(artifact_id, user_id):
        if node_id not in valid_ids:
            execute(
                "DELETE FROM knowledge_map_node_progress WHERE artifact_id = %s AND user_id = %s AND node_id = %s",
                (artifact_id, user_id, node_id),
            )
    return get_map_progress(artifact_id, user_id)


def _normalized(value: object) -> str:
    return re.sub(r"\s+", "", str(value or "").lower())


def _matches_node(label: str, knowledge_point: str) -> bool:
    left, right = _normalized(label), _normalized(knowledge_point)
    if not left or not right:
        return False
    return left == right or (len(left) >= 2 and left in right) or (len(right) >= 2 and right in left)


def apply_practice_results(artifact_id: int, user_id: int, results: list[dict]) -> dict | None:
    """Reflect a map-focused practice attempt back into the covered map nodes."""
    nodes = _map_nodes(artifact_id, user_id)
    if nodes is None:
        return None
    outcomes: dict[str, dict[str, bool]] = {}
    for result in results or []:
        point = str(result.get("knowledge_point") or "")
        for node in nodes:
            if not _matches_node(node["label"], point):
                continue
            outcome = outcomes.setdefault(node["id"], {"correct": False, "incorrect": False})
            if result.get("correct"):
                outcome["correct"] = True
            else:
                outcome["incorrect"] = True
    for node_id, outcome in outcomes.items():
        set_map_node_progress(
            artifact_id,
            user_id,
            node_id,
            "review" if outcome["incorrect"] else "mastered" if outcome["correct"] else "new",
        )
    return get_map_progress(artifact_id, user_id)
