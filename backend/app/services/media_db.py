"""Persistence helpers for provider-backed video generation tasks."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.database import execute, query


def create_video_task(
    user_id: int,
    task_id: str,
    prompt: str,
    size: str,
    duration: int,
) -> dict:
    execute(
        "INSERT INTO video_tasks (task_id, user_id, prompt, size, duration, status) "
        "VALUES (%s, %s, %s, %s, %s, 'PENDING')",
        (task_id, user_id, prompt, size, duration),
    )
    return get_video_task(task_id, user_id) or {
        "task_id": task_id,
        "user_id": user_id,
        "prompt": prompt,
        "size": size,
        "duration": duration,
        "status": "PENDING",
    }


def get_video_task(task_id: str, user_id: int) -> dict | None:
    rows = query(
        "SELECT task_id, user_id, prompt, size, duration, status, video_url, "
        "local_url, error, created_at, updated_at, completed_at "
        "FROM video_tasks WHERE task_id = %s AND user_id = %s",
        (task_id, user_id),
    )
    return rows[0] if rows else None


def update_video_task(
    task_id: str,
    user_id: int,
    *,
    status: str,
    video_url: str = "",
    local_url: str = "",
    error: str = "",
) -> dict | None:
    completed = status in {"SUCCEEDED", "FAILED"}
    execute(
        "UPDATE video_tasks SET status = %s, video_url = %s, local_url = %s, "
        "error = %s, completed_at = CASE WHEN %s THEN CURRENT_TIMESTAMP ELSE completed_at END "
        "WHERE task_id = %s AND user_id = %s",
        (status, video_url, local_url, error, completed, task_id, user_id),
    )
    return get_video_task(task_id, user_id)


def prune_video_tasks(days: int = 14) -> None:
    """Keep task metadata bounded; downloaded assets are managed separately."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).replace(tzinfo=None)
    execute(
        "DELETE FROM video_tasks WHERE completed_at IS NOT NULL "
        "AND completed_at < %s",
        (cutoff,),
    )
