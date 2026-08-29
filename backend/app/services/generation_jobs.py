"""Background generation jobs with a durable database snapshot and memory fallback.

The worker remains lightweight for local development, while job status, progress,
results and safe failures are written to the database when it is available. Jobs
intentionally contain no prompt text or API credentials.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import json
import logging
from threading import Lock
from typing import Any, Callable
from uuid import uuid4


logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="rhyme-generation")
_jobs: dict[str, dict[str, Any]] = {}
_lock = Lock()
_expiry = timedelta(hours=1)
_persistence_enabled: bool | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value).replace(" ", "T")


def _public(job: dict[str, Any]) -> dict[str, Any]:
    response = {
        "job_id": job["job_id"],
        "kind": job["kind"],
        "status": job["status"],
        "created_at": _iso(job["created_at"]),
    }
    if job.get("started_at"):
        response["started_at"] = _iso(job["started_at"])
    if job.get("finished_at"):
        response["finished_at"] = _iso(job["finished_at"])
    if job["status"] == "completed":
        response["result"] = job.get("result", {})
    if job["status"] == "failed":
        response["error"] = job.get("error", "生成没有完成，请稍后重试")
        response["error_code"] = job.get("error_code", "generation_failed")
        response["retryable"] = bool(job.get("retryable", True))
    if job.get("progress"):
        response["progress"] = dict(job["progress"])
    return response


def _ensure_job_table() -> bool:
    """Create the durable job table when a database is available.

    Tests and lightweight offline imports may run without a usable database;
    those callers keep the original in-memory behaviour instead of failing
    generation solely because persistence is unavailable.
    """
    global _persistence_enabled
    if _persistence_enabled is not None:
        return _persistence_enabled
    try:
        from app.database import execute

        execute("""
            CREATE TABLE IF NOT EXISTS generation_jobs (
                job_id VARCHAR(80) PRIMARY KEY,
                user_id INT NOT NULL,
                kind VARCHAR(48) NOT NULL,
                status VARCHAR(20) NOT NULL,
                dedupe_key VARCHAR(240),
                result JSON,
                error TEXT,
                error_code VARCHAR(48),
                retryable TINYINT NOT NULL DEFAULT 1,
                progress JSON,
                created_at DATETIME NOT NULL,
                started_at DATETIME,
                finished_at DATETIME
            )
        """)
        _persistence_enabled = True
    except Exception:
        logger.debug("generation job persistence unavailable; using memory fallback", exc_info=True)
        _persistence_enabled = False
    return _persistence_enabled


def init_tables() -> None:
    """Prepare the job snapshot table during application startup."""
    _ensure_job_table()


def recover_incomplete_jobs() -> int:
    """Close jobs whose in-process worker disappeared during a restart.

    The lightweight local worker cannot reconstruct arbitrary Python closures
    after a process restart.  Leaving those rows as ``running`` is worse: the
    browser would show an endless spinner forever.  We convert them into an
    explicit, retryable failure so the original request remains visible and
    the existing UI can offer a one-click retry.
    """
    if not _ensure_job_table():
        return 0
    try:
        from app.database import execute, query

        rows = query(
            "SELECT job_id, progress FROM generation_jobs "
            "WHERE status IN ('queued', 'running')"
        )
        recovered = 0
        for row in rows:
            progress = row.get("progress")
            if isinstance(progress, str):
                try:
                    progress = json.loads(progress)
                except json.JSONDecodeError:
                    progress = {}
            progress = progress if isinstance(progress, dict) else {}
            progress = {
                **progress,
                "phase": "failed",
                "label": "服务重启后需要重试",
                "message": "服务在生成过程中重启，原始学习内容已保留，可立即重试。",
                "error_code": "worker_restarted",
            }
            execute(
                "UPDATE generation_jobs SET status = 'failed', error = %s, "
                "error_code = 'worker_restarted', retryable = %s, progress = %s, "
                "finished_at = CURRENT_TIMESTAMP WHERE job_id = %s "
                "AND status IN ('queued', 'running')",
                (
                    "服务在生成过程中重启，原始学习内容已保留，可立即重试。",
                    True,
                    _json(progress),
                    row["job_id"],
                ),
            )
            recovered += 1
        if recovered:
            logger.warning("recovered %s incomplete generation jobs after startup", recovered)
        return recovered
    except Exception:
        logger.debug("could not recover incomplete generation jobs", exc_info=True)
        return 0


def _json(value: Any) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _reset_persistence_after_schema_error(exc: BaseException) -> bool:
    """Allow tests/dev reloads that swap the SQLite file at runtime to recover."""
    message = str(exc).lower()
    if "no such table" not in message and "doesn't exist" not in message:
        return False
    global _persistence_enabled
    _persistence_enabled = None
    return True


def _db_insert(job: dict[str, Any]) -> None:
    if not _ensure_job_table():
        return
    try:
        from app.database import execute

        execute(
            "INSERT INTO generation_jobs "
            "(job_id, user_id, kind, status, dedupe_key, result, error, error_code, retryable, progress, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (
                job["job_id"], job["user_id"], job["kind"], job["status"], job.get("dedupe_key"),
                _json(job.get("result")), job.get("error"), job.get("error_code"),
                bool(job.get("retryable", True)), _json(job.get("progress", {})),
                job["created_at"].replace(tzinfo=None),
            ),
        )
    except Exception as exc:
        if _reset_persistence_after_schema_error(exc) and _ensure_job_table():
            try:
                _db_insert(job)
                return
            except Exception:
                pass
        logger.debug("could not persist generation job %s", job.get("job_id"), exc_info=True)


def _db_update(job: dict[str, Any]) -> None:
    if not _ensure_job_table():
        return
    try:
        from app.database import execute

        execute(
            "UPDATE generation_jobs SET status = %s, result = %s, error = %s, error_code = %s, "
            "retryable = %s, progress = %s, started_at = %s, finished_at = %s WHERE job_id = %s",
            (
                job["status"], _json(job.get("result")), job.get("error"), job.get("error_code"),
                bool(job.get("retryable", True)), _json(job.get("progress", {})),
                job["started_at"].replace(tzinfo=None) if hasattr(job.get("started_at"), "replace") else job.get("started_at"),
                job["finished_at"].replace(tzinfo=None) if hasattr(job.get("finished_at"), "replace") else job.get("finished_at"),
                job["job_id"],
            ),
        )
    except Exception as exc:
        if _reset_persistence_after_schema_error(exc) and _ensure_job_table():
            try:
                _db_update(job)
                return
            except Exception:
                pass
        logger.debug("could not update generation job %s", job.get("job_id"), exc_info=True)


def _db_prune() -> None:
    if not _ensure_job_table():
        return
    try:
        from app.database import execute

        cutoff = (_now() - _expiry).replace(tzinfo=None)
        execute(
            "DELETE FROM generation_jobs WHERE finished_at IS NOT NULL AND finished_at < %s",
            (cutoff,),
        )
    except Exception as exc:
        _reset_persistence_after_schema_error(exc)
        logger.debug("could not prune persisted generation jobs", exc_info=True)


def _db_fetch(job_id: str, user_id: int) -> dict[str, Any] | None:
    if not _ensure_job_table():
        return None
    try:
        from app.database import query

        rows = query(
            "SELECT job_id, user_id, kind, status, dedupe_key, result, error, error_code, "
            "retryable, progress, created_at, started_at, finished_at "
            "FROM generation_jobs WHERE job_id = %s AND user_id = %s",
            (job_id, user_id),
        )
    except Exception as exc:
        _reset_persistence_after_schema_error(exc)
        logger.debug("could not read persisted generation job %s", job_id, exc_info=True)
        return None
    if not rows:
        return None
    row = rows[0]
    try:
        result = row.get("result")
        progress = row.get("progress")
        result = result if isinstance(result, (dict, list)) else json.loads(result) if result else None
        progress = progress if isinstance(progress, dict) else json.loads(progress) if progress else {}
    except (TypeError, json.JSONDecodeError):
        result, progress = None, {}
    return {
        "job_id": row["job_id"],
        "user_id": row["user_id"],
        "kind": row["kind"],
        "status": row["status"],
        "dedupe_key": row.get("dedupe_key"),
        "result": result,
        "error": row.get("error"),
        "error_code": row.get("error_code"),
        "retryable": bool(row.get("retryable", 1)),
        "progress": progress,
        "created_at": row.get("created_at"),
        "started_at": row.get("started_at"),
        "finished_at": row.get("finished_at"),
    }


def _exception_chain(exc: BaseException) -> list[BaseException]:
    chain: list[BaseException] = []
    seen: set[int] = set()
    current: BaseException | None = exc
    while current and id(current) not in seen:
        chain.append(current)
        seen.add(id(current))
        current = current.__cause__ or current.__context__
    return chain


def _safe_failure(exc: BaseException) -> dict[str, Any]:
    """Turn implementation failures into actionable, credential-safe UI copy."""
    chain = _exception_chain(exc)
    names = {item.__class__.__name__ for item in chain}
    status_codes = {getattr(item, "status_code", None) for item in chain}

    if names & {"ConnectTimeout", "ReadTimeout", "WriteTimeout", "PoolTimeout", "APITimeoutError"}:
        return {
            "error": "模型服务响应超时，系统已自动重试；原始问答已保留，可立即重试。",
            "error_code": "model_timeout",
            "retryable": True,
            "label": "模型服务响应超时",
        }
    if names & {"ConnectError", "NetworkError", "APIConnectionError"}:
        return {
            "error": "暂时无法连接模型服务，系统已自动重试；请检查网络后立即重试。",
            "error_code": "model_connection",
            "retryable": True,
            "label": "模型服务连接中断",
        }
    if 429 in status_codes or "RateLimitError" in names:
        return {
            "error": "模型服务当前较繁忙，系统已保留本次学习内容，请稍后立即重试。",
            "error_code": "model_busy",
            "retryable": True,
            "label": "模型服务繁忙",
        }
    if status_codes & {500, 502, 503, 504} or names & {"InternalServerError", "ServiceUnavailableError"}:
        return {
            "error": "模型服务暂时不可用，原始问答不会丢失，稍后可直接重试。",
            "error_code": "model_unavailable",
            "retryable": True,
            "label": "模型服务暂不可用",
        }

    detail = next((getattr(item, "detail", None) for item in chain if getattr(item, "detail", None)), None)
    if isinstance(detail, str) and detail:
        lowered = detail.lower()
        if "动画质量" in detail:
            return {"error": detail, "error_code": "quality_gate", "retryable": True, "label": "动画质量需要重做"}
        if "没有找到" in detail or "缺少原始问题" in detail:
            return {"error": detail, "error_code": "source_unavailable", "retryable": False, "label": "来源内容不可用"}
        if "无效" in lowered or "不存在" in detail:
            return {"error": detail, "error_code": "request_invalid", "retryable": False, "label": "生成条件需要检查"}

    return {
        "error": "生成暂时没有完成，原始学习内容已保留，可立即重试。",
        "error_code": "generation_failed",
        "retryable": True,
        "label": "本次生成未完成",
    }


def _prune_locked() -> None:
    cutoff = _now() - _expiry
    expired = [
        job_id for job_id, job in _jobs.items()
        if job.get("finished_at") and job["finished_at"] < cutoff
    ]
    for job_id in expired:
        _jobs.pop(job_id, None)


def submit_generation_job(
    kind: str,
    user_id: int,
    work: Callable[[], dict[str, Any]],
    *,
    dedupe_key: str | None = None,
    progress_initial: dict[str, Any] | None = None,
    with_progress: bool = False,
) -> dict[str, Any]:
    """Queue work and return a safe public snapshot immediately."""
    _ensure_job_table()
    _db_prune()
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
        "error_code": None,
        "retryable": True,
        "dedupe_key": dedupe_key,
        "progress": dict(progress_initial or {}),
    }
    with _lock:
        _prune_locked()
        if dedupe_key:
            existing = next((
                item for item in _jobs.values()
                if item.get("user_id") == user_id
                and item.get("dedupe_key") == dedupe_key
                and item.get("status") in {"queued", "running"}
            ), None)
            if existing:
                return _public(existing)
        _db_insert(job)
        _jobs[job_id] = job

    def run() -> None:
        with _lock:
            job["status"] = "running"
            job["started_at"] = _now()
            _db_update(job)
        try:
            def report_progress(update: dict[str, Any]) -> None:
                if not isinstance(update, dict):
                    return
                with _lock:
                    if job["status"] not in {"queued", "running"}:
                        return
                    job["progress"] = {**job.get("progress", {}), **update}
                    _db_update(job)

            result = work(report_progress) if with_progress else work()
        except Exception as exc:  # The API returns a safe failure through polling.
            failure = _safe_failure(exc)
            if failure["error_code"] == "generation_failed":
                logger.exception("generation job failed: kind=%s job=%s", kind, job_id)
            else:
                logger.warning(
                    "generation job stopped: kind=%s job=%s code=%s",
                    kind,
                    job_id,
                    failure["error_code"],
                )
            with _lock:
                job["status"] = "failed"
                job["error"] = failure["error"]
                job["error_code"] = failure["error_code"]
                job["retryable"] = failure["retryable"]
                job["progress"] = {
                    **job.get("progress", {}),
                    "phase": "failed",
                    "label": failure["label"],
                    "message": failure["error"],
                    "percent": min(99, max(0, int(job.get("progress", {}).get("percent") or 0))),
                    "error_code": failure["error_code"],
                }
                job["finished_at"] = _now()
                _db_update(job)
            return
        with _lock:
            job["status"] = "completed"
            job["result"] = result
            job["finished_at"] = _now()
            _db_update(job)

    _executor.submit(run)
    return _public(job)


def get_generation_job(job_id: str, user_id: int) -> dict[str, Any] | None:
    with _lock:
        _prune_locked()
        job = _jobs.get(job_id)
        if job:
            if job["user_id"] != user_id:
                return None
            return _public(job)
    persisted = _db_fetch(job_id, user_id)
    return _public(persisted) if persisted else None
