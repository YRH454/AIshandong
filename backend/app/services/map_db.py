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
    execute("""
        CREATE TABLE IF NOT EXISTS knowledge_map_workspace_progress (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            artifact_id INT NOT NULL,
            active_node_id VARCHAR(80) NOT NULL DEFAULT '',
            explored_node_ids JSON NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, artifact_id)
        )
    """)


def _map_payload(artifact_id: int, user_id: int) -> dict | None:
    rows = query(
        "SELECT kind, status, content FROM learning_artifacts WHERE id = %s AND user_id = %s",
        (artifact_id, user_id),
    )
    if not rows or rows[0].get("kind") != "map" or rows[0].get("status") == "deleted":
        return None
    try:
        payload = json.loads(rows[0].get("content") or "{}")
    except (TypeError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _map_nodes(artifact_id: int, user_id: int) -> list[dict] | None:
    payload = _map_payload(artifact_id, user_id)
    if payload is None:
        return None
    nodes = payload.get("nodes") if isinstance(payload, dict) else []
    if not isinstance(nodes, list):
        return []
    return [
        {
            "id": str(node.get("id") or "").strip(),
            "label": str(node.get("label") or "").strip(),
            "role": str(node.get("role") or "branch").strip(),
        }
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


def _workspace_progress(artifact_id: int, user_id: int, payload: dict, nodes: list[dict]) -> dict:
    valid_ids = {node["id"] for node in nodes if node.get("role") != "core"}
    rows = query(
        "SELECT active_node_id, explored_node_ids, updated_at FROM knowledge_map_workspace_progress "
        "WHERE artifact_id = %s AND user_id = %s",
        (artifact_id, user_id),
    )
    row = rows[0] if rows else {}
    try:
        explored_value = row.get("explored_node_ids") or "[]"
        explored_raw = explored_value if isinstance(explored_value, list) else json.loads(explored_value)
    except (TypeError, json.JSONDecodeError):
        explored_raw = []
    if not isinstance(explored_raw, list):
        explored_raw = []
    explored = list(dict.fromkeys(
        str(node_id).strip() for node_id in explored_raw
        if str(node_id).strip() in valid_ids
    ))
    active_node_id = str(row.get("active_node_id") or "").strip()
    if active_node_id not in valid_ids:
        active_node_id = ""
    deep_maps = payload.get("deep_maps") if isinstance(payload.get("deep_maps"), dict) else {}
    generated = [node["id"] for node in nodes if node["id"] in valid_ids and isinstance(deep_maps.get(node["id"]), dict)]
    return {
        "active_node_id": active_node_id,
        "explored_node_ids": explored,
        "generated_deep_dive_ids": generated,
        "total_deep_dives": len(valid_ids),
        "updated_at": str(row.get("updated_at") or ""),
    }


def get_map_progress(artifact_id: int, user_id: int) -> dict | None:
    payload = _map_payload(artifact_id, user_id)
    if payload is None:
        return None
    nodes = _map_nodes(artifact_id, user_id) or []
    trackable_nodes = [node for node in nodes if node.get("role") != "core"]
    valid_ids = {node["id"] for node in trackable_nodes}
    progress = {node_id: status for node_id, status in _progress_rows(artifact_id, user_id).items() if node_id in valid_ids}
    mastered = sum(status == "mastered" for status in progress.values())
    review = sum(status == "review" for status in progress.values())
    return {
        "progress": progress,
        "summary": {
            "total": len(trackable_nodes),
            "mastered": mastered,
            "review": review,
            "untouched": max(0, len(trackable_nodes) - mastered - review),
        },
        "exploration": _workspace_progress(artifact_id, user_id, payload, nodes),
    }


def update_map_workspace_progress(
    artifact_id: int,
    user_id: int,
    active_node_id: str,
    explored_node_ids: list[str],
) -> dict | None:
    payload = _map_payload(artifact_id, user_id)
    if payload is None:
        return None
    nodes = _map_nodes(artifact_id, user_id) or []
    valid_ids = {node["id"] for node in nodes if node.get("role") != "core"}
    active = str(active_node_id or "").strip()
    if active and active not in valid_ids:
        return None
    explored = list(dict.fromkeys(
        str(node_id).strip() for node_id in explored_node_ids
        if str(node_id).strip() in valid_ids
    ))[:24]
    if active and active not in explored:
        explored.append(active)
    existing = query(
        "SELECT id FROM knowledge_map_workspace_progress WHERE artifact_id = %s AND user_id = %s",
        (artifact_id, user_id),
    )
    if existing:
        execute(
            "UPDATE knowledge_map_workspace_progress SET active_node_id = %s, explored_node_ids = %s, "
            "updated_at = NOW() WHERE id = %s",
            (active, json.dumps(explored, ensure_ascii=False), existing[0]["id"]),
        )
    else:
        insert("knowledge_map_workspace_progress", {
            "user_id": user_id,
            "artifact_id": artifact_id,
            "active_node_id": active,
            "explored_node_ids": json.dumps(explored, ensure_ascii=False),
        })
    return get_map_progress(artifact_id, user_id)


def set_map_node_progress(artifact_id: int, user_id: int, node_id: str, status: str) -> dict | None:
    nodes = _map_nodes(artifact_id, user_id)
    if nodes is None:
        return None
    target = next((node for node in nodes if node["id"] == node_id), None)
    if target is None or target.get("role") == "core":
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
    execute(
        "DELETE FROM knowledge_map_workspace_progress WHERE artifact_id = %s AND user_id = %s",
        (artifact_id, user_id),
    )


def prune_map_progress(artifact_id: int, user_id: int) -> dict | None:
    """Drop progress rows for nodes removed from an edited canvas."""
    nodes = _map_nodes(artifact_id, user_id)
    if nodes is None:
        return None
    valid_ids = {node["id"] for node in nodes if node.get("role") != "core"}
    for node_id in _progress_rows(artifact_id, user_id):
        if node_id not in valid_ids:
            execute(
                "DELETE FROM knowledge_map_node_progress WHERE artifact_id = %s AND user_id = %s AND node_id = %s",
                (artifact_id, user_id, node_id),
            )
    payload = _map_payload(artifact_id, user_id) or {}
    workspace = _workspace_progress(artifact_id, user_id, payload, nodes)
    if workspace["active_node_id"] or workspace["explored_node_ids"]:
        update_map_workspace_progress(
            artifact_id,
            user_id,
            workspace["active_node_id"],
            workspace["explored_node_ids"],
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
            if node.get("role") == "core":
                continue
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
