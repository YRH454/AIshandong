"""Small in-process queue for long-running learning-material generation.

The demo runs as one local FastAPI process, so a durable external queue would add
more operational weight than value.  This queue keeps slow model work off the
request that created it while still exposing an explicit, pollable job state to
the UI.  Jobs intentionally contain no prompt text or API credentials.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import logging
from threading import Lock
from typing import Any, Callable
from uuid import uuid4


logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="rhyme-generation")
_jobs: dict[str, dict[str, Any]] = {}
_lock = Lock()
_expiry = timedelta(hours=1)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _public(job: dict[str, Any]) -> dict[str, Any]:
    response = {
        "job_id": job["job_id"],
        "kind": job["kind"],
        "status": job["status"],
        "created_at": job["created_at"].isoformat(),
    }
    if job.get("started_at"):
        response["started_at"] = job["started_at"].isoformat()
    if job.get("finished_at"):
        response["finished_at"] = job["finished_at"].isoformat()
    if job["status"] == "completed":
        response["result"] = job.get("result", {})
    if job["status"] == "failed":
        response["error"] = job.get("error", "生成没有完成，请稍后重试")
    return response


def _prune_locked() -> None:
    cutoff = _now() - _expiry
    expired = [
        job_id for job_id, job in _jobs.items()
        if job.get("finished_at") and job["finished_at"] < cutoff
    ]
    for job_id in expired:
        _jobs.pop(job_id, None)


def submit_generation_job(kind: str, user_id: int, work: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    """Queue work and return a safe public snapshot immediately."""
    job_id = uuid4().hex
    job = {
        "job_id": job_id,
        "kind": kind,
        "user_id": user_id,
        "status": "queued",
        "created_at": _now(),
        "started_at": None,
        "finished_at": None,
        "result": None,
        "error": None,
    }
    with _lock:
        _prune_locked()
        _jobs[job_id] = job

    def run() -> None:
        with _lock:
            job["status"] = "running"
            job["started_at"] = _now()
        try:
            result = work()
        except Exception as exc:  # The API returns a safe failure through polling.
            logger.exception("generation job failed: kind=%s job=%s", kind, job_id)
            with _lock:
                job["status"] = "failed"
                job["error"] = "生成没有完成，请稍后重试"
                job["finished_at"] = _now()
            return
        with _lock:
            job["status"] = "completed"
            job["result"] = result
            job["finished_at"] = _now()

    _executor.submit(run)
    return _public(job)


def get_generation_job(job_id: str, user_id: int) -> dict[str, Any] | None:
    with _lock:
        _prune_locked()
        job = _jobs.get(job_id)
        if not job or job["user_id"] != user_id:
            return None
        return _public(job)
