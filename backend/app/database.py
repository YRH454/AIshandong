import pymysql
import os
import re
import sqlite3
import threading
import queue
from app.config import (
    MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE,
    DB_BACKEND, SQLITE_PATH,
)

# ── 简易连接池（避免每次查询都新建 TCP 连接）─────────────────────
_POOL_SIZE = 5
_pool = queue.Queue(maxsize=_POOL_SIZE)
_pool_lock = threading.Lock()

def _create_conn():
    if DB_BACKEND == "sqlite":
        os.makedirs(os.path.dirname(SQLITE_PATH), exist_ok=True)
        conn = sqlite3.connect(SQLITE_PATH, timeout=15, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    return pymysql.connect(
        host=MYSQL_HOST, port=MYSQL_PORT,
        user=MYSQL_USER, password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE, charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor, autocommit=False,
        connect_timeout=10, read_timeout=30, write_timeout=30,
    )

def get_connection():
    """从连接池获取连接，池空时新建（超过上限则等待）"""
    if DB_BACKEND == "sqlite":
        return _create_conn()
    try:
        return _pool.get_nowait()
    except queue.Empty:
        return _create_conn()

def _return_conn(conn):
    """将连接归还池中，池满则关闭"""
    if DB_BACKEND == "sqlite":
        conn.close()
        return
    try:
        conn.ping(reconnect=True)
        _pool.put_nowait(conn)
    except (queue.Full, Exception):
        try:
            conn.close()
        except Exception:
            pass


def _normalize_sql(sql: str) -> str:
    if DB_BACKEND != "sqlite":
        return sql
    value = sql.replace("%s", "?")
    value = re.sub(r"\bINT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY\b", "INTEGER PRIMARY KEY AUTOINCREMENT", value, flags=re.I)
    value = re.sub(r"\bTINYINT\b", "INTEGER", value, flags=re.I)
    value = re.sub(r"\bJSON\b", "TEXT", value, flags=re.I)
    # 兼容 "..., ON UPDATE CURRENT_TIMESTAMP"(逗号后带空白)与无逗号两种写法
    value = re.sub(r",?\s*ON\s+UPDATE\s+CURRENT_TIMESTAMP", "", value, flags=re.I)
    value = re.sub(r"\bNOW\(\)", "CURRENT_TIMESTAMP", value, flags=re.I)
    # SQLite 不识别 TRUE/FALSE 字面量
    value = re.sub(r"\bTRUE\b", "1", value, flags=re.I)
    value = re.sub(r"\bFALSE\b", "0", value, flags=re.I)
    return value


def _bind_params(params) -> tuple:
    """SQLite 不识别 Python bool/None,统一转成 int/兼容类型"""
    if DB_BACKEND != "sqlite":
        return tuple(params) if params else ()
    if params is None:
        return ()
    return tuple(
        1 if p is True else 0 if p is False else (p if p is not None else None)
        for p in params
    )


def query(sql: str, params=None):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(_normalize_sql(sql), _bind_params(params))
        rows = cursor.fetchall()
        return [dict(row) for row in rows] if DB_BACKEND == "sqlite" else rows
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        _return_conn(conn)


def execute(sql: str, params=None) -> int:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(_normalize_sql(sql), _bind_params(params))
        conn.commit()
        return cursor.lastrowid
    except Exception:
        conn.rollback()
        raise
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        _return_conn(conn)


def insert(table: str, data: dict) -> int:
    """插入一行并返回自增 ID"""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cols = list(data.keys())
        vals = list(data.values())
        ph = ", ".join(["%s"] * len(cols))
        cursor.execute(_normalize_sql(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({ph})"), _bind_params(vals))
        conn.commit()
        return cursor.lastrowid
    except Exception:
        conn.rollback()
        raise
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        _return_conn(conn)


def insert_with_next_id(table: str, data: dict, id_column: str = "id") -> int:
    """Insert a row with a database-locked next id.

    A few legacy tables use an explicit integer primary key instead of an
    auto-increment column.  Keeping the allocation and insert in one
    transaction avoids the old ``MAX(id) + 1`` race when two users register or
    start guest sessions at the same time.
    """
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", table) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", id_column):
        raise ValueError("invalid table or id column")
    conn = get_connection()
    cursor = None
    try:
        cursor = conn.cursor()
        if DB_BACKEND == "sqlite":
            cursor.execute("BEGIN IMMEDIATE")
            lock_suffix = ""
        else:
            lock_suffix = " FOR UPDATE"
        cursor.execute(
            _normalize_sql(
                f"SELECT COALESCE(MAX({id_column}), 0) + 1 AS next_id FROM {table}{lock_suffix}"
            ),
            (),
        )
        row = cursor.fetchone()
        next_id = row["next_id"] if isinstance(row, dict) else row[0]
        values = {id_column: next_id, **data}
        columns = list(values.keys())
        placeholders = ", ".join(["%s"] * len(columns))
        cursor.execute(
            _normalize_sql(
                f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
            ),
            _bind_params([values[column] for column in columns]),
        )
        conn.commit()
        return int(next_id)
    except Exception:
        conn.rollback()
        raise
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        _return_conn(conn)


def init_core_tables():
    """初始化认证、画像和会话表，支持 MySQL 与本地 SQLite 演示模式。"""
    execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY,
            username VARCHAR(60) NOT NULL UNIQUE,
            email VARCHAR(160) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'user',
            avatar_url VARCHAR(500) DEFAULT '',
            is_active TINYINT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    execute("""
        CREATE TABLE IF NOT EXISTS guest_sessions (
            id INT PRIMARY KEY,
            session_token VARCHAR(255) NOT NULL,
            session_token_hash VARCHAR(128),
            remaining_questions INT DEFAULT 3,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME
        )
    """)
    execute("""
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token_hash VARCHAR(128) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            revoked_at DATETIME NULL
        )
    """)
    _ensure_column("guest_sessions", "session_token_hash", "VARCHAR(128)")
    _ensure_column("users", "email_verified", "TINYINT DEFAULT 0")
    execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token_hash VARCHAR(128) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    try:
        execute("CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens (user_id, used_at)")
    except Exception as exc:
        if "already exists" not in str(exc).lower() and "duplicate key" not in str(exc).lower():
            raise
    execute("""
        CREATE TABLE IF NOT EXISTS student_profiles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            profile_data TEXT NOT NULL,
            version INT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    execute("""
        CREATE TABLE IF NOT EXISTS profile_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            profile_id INT NOT NULL,
            change_log TEXT,
            trigger_event VARCHAR(80),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    execute("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_type VARCHAR(40) NOT NULL,
            title VARCHAR(160) DEFAULT '',
            messages TEXT NOT NULL,
            learning_state TEXT NOT NULL DEFAULT '{}',
            is_pinned TINYINT DEFAULT 0,
            is_active TINYINT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    _ensure_column("chat_sessions", "title", "VARCHAR(160) DEFAULT ''")
    _ensure_column("chat_sessions", "learning_state", "TEXT NOT NULL DEFAULT '{}'")
    _ensure_column("chat_sessions", "is_pinned", "TINYINT DEFAULT 0")


def _ensure_column(table: str, column: str, definition: str):
    """为已有演示库做轻量迁移；列已存在时安全跳过。"""
    if DB_BACKEND == "sqlite":
        columns = query(f"PRAGMA table_info({table})")
        if any(row.get("name") == column for row in columns):
            return
    else:
        columns = query(f"SHOW COLUMNS FROM {table} LIKE %s", (column,))
        if columns:
            return
    execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
