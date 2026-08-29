"""Small, repeatable schema migration runner.

The existing feature modules still keep their lightweight ``CREATE TABLE IF
NOT EXISTS`` bootstrap for local demos.  New production-sensitive tables are
registered here so deployments have an auditable version marker and can safely
run startup more than once.
"""

from __future__ import annotations

from collections.abc import Callable

from app.database import execute, query


Migration = tuple[int, str, Callable[[], None]]


def _try_execute(sql: str) -> None:
    """Execute an idempotent DDL statement, tolerating an existing index."""
    try:
        execute(sql)
    except Exception as exc:
        message = str(exc).lower()
        if "already exists" not in message and "duplicate key name" not in message:
            raise


def _migration_video_tasks() -> None:
    execute("""
        CREATE TABLE IF NOT EXISTS video_tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id VARCHAR(160) NOT NULL UNIQUE,
            user_id INT NOT NULL,
            prompt TEXT NOT NULL,
            size VARCHAR(32) NOT NULL DEFAULT '1280*720',
            duration INT NOT NULL DEFAULT 5,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            video_url VARCHAR(700) DEFAULT '',
            local_url VARCHAR(700) DEFAULT '',
            error TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            completed_at DATETIME NULL
        )
    """)
    _try_execute("CREATE INDEX idx_video_tasks_user_status ON video_tasks (user_id, status)")
    _try_execute("CREATE INDEX idx_video_tasks_updated_at ON video_tasks (updated_at)")


MIGRATIONS: tuple[Migration, ...] = (
    (1, "video_tasks_user_ownership", _migration_video_tasks),
)


def run_migrations() -> None:
    """Apply pending migrations exactly once per database."""
    execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INT PRIMARY KEY,
            name VARCHAR(160) NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    applied = {int(row["version"]) for row in query("SELECT version FROM schema_migrations")}
    for version, name, migration in MIGRATIONS:
        if version in applied:
            continue
        migration()
        try:
            execute(
                "INSERT INTO schema_migrations (version, name) VALUES (%s, %s)",
                (version, name),
            )
        except Exception as exc:
            # Another process may have won a simultaneous startup race after
            # the idempotent DDL completed.  Surface all other failures.
            message = str(exc).lower()
            if "duplicate" not in message and "unique constraint" not in message:
                raise
