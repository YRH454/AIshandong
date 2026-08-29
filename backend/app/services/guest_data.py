"""Temporary storage helpers for full-featured guest sessions.

Guests use the same learning APIs as registered users, but their data is
partitioned by a negative, session-derived user id.  This keeps concurrent
guest sessions isolated without creating fake accounts in ``users``.  The
rows are removed on logout and when the 24-hour guest session expires.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def guest_user_id(session_id: int) -> int:
    """Return a collision-safe internal user id for a guest session."""
    value = abs(int(session_id))
    if value == 0:
        raise ValueError("guest session id must be non-zero")
    return -value


def _query_ids(sql: str, params: tuple[object, ...]) -> list[int]:
    from app.database import query

    try:
        rows = query(sql, params)
    except Exception:
        return []
    ids: list[int] = []
    for row in rows:
        value = row.get("id") if isinstance(row, dict) else None
        try:
            if value is not None:
                ids.append(int(value))
        except (TypeError, ValueError):
            continue
    return ids


def _delete(sql: str, params: tuple[object, ...]) -> int:
    from app.database import execute

    try:
        execute(sql, params)
        return 1
    except Exception as exc:
        # A deployment may not have initialized every optional feature table
        # yet.  Cleanup is deliberately best-effort in that case; the guest
        # session itself is still revoked by the caller.
        message = str(exc).lower()
        if any(marker in message for marker in ("no such table", "doesn't exist", "unknown table")):
            return 0
        logger.debug("guest data cleanup skipped statement", exc_info=True)
        return 0


def _delete_in(table: str, column: str, ids: list[int]) -> int:
    if not ids:
        return 0
    placeholders = ", ".join(["%s"] * len(ids))
    return _delete(f"DELETE FROM {table} WHERE {column} IN ({placeholders})", tuple(ids))


def purge_guest_data(user_id: int) -> int:
    """Delete all transient rows belonging to one guest session.

    ``user_id`` must be the negative id returned by :func:`guest_user_id`;
    positive ids are ignored so a cleanup bug cannot touch a real account.
    The function tolerates feature tables that are not installed in a small
    local deployment.
    """
    user_id = int(user_id)
    if user_id >= 0:
        return 0

    # Collect ids for tables whose rows are linked indirectly by package,
    # practice-set or profile ids and therefore do not carry user_id.
    package_ids = _query_ids("SELECT id FROM resource_packages WHERE user_id = %s", (user_id,))
    practice_set_ids = _query_ids("SELECT id FROM practice_sets WHERE user_id = %s", (user_id,))
    profile_ids = _query_ids("SELECT id FROM student_profiles WHERE user_id = %s", (user_id,))

    removed = 0
    removed += _delete_in("generated_media", "package_id", package_ids)
    removed += _delete_in("practice_attempts", "practice_set_id", practice_set_ids)
    removed += _delete_in("profile_history", "profile_id", profile_ids)

    # Every table below is partitioned by user_id.  Keep the list explicit so
    # cleanup cannot accidentally scan or mutate unrelated application tables.
    user_tables = (
        "auth_sessions",
        "generation_jobs",
        "video_tasks",
        "chat_sessions",
        "student_profiles",
        "library_courses",
        "library_topics",
        "learning_artifacts",
        "library_classification_feedback",
        "resource_packages",
        "quiz_records",
        "audit_logs",
        "learning_paths",
        "learning_events",
        "mastery_states",
        "path_revisions",
        "learning_topic_states",
        "learning_activities",
        "interactive_presentation_progress",
        "topic_study_plans",
        "knowledge_map_node_progress",
        "knowledge_map_workspace_progress",
        "practice_sets",
        "practice_attempts",
    )
    for table in user_tables:
        removed += _delete(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))

    return removed
