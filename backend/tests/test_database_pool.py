"""MySQL repeatable-read regressions not exercised by the SQLite auth tests."""

from pathlib import Path
import queue
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import database


SELECT_SESSION = "SELECT id FROM auth_sessions WHERE token_hash = %s AND revoked_at IS NULL"
INSERT_SESSION = "INSERT INTO auth_sessions (token_hash) VALUES (%s)"
REVOKE_SESSION = "UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = %s"


class RepeatableReadConnection:
    """Two connections share committed rows but keep separate transaction snapshots."""

    def __init__(self, committed):
        self.committed = committed
        self.snapshot = None
        self.pending = None
        self.closed = False
        self.reset_fails = False

    def cursor(self):
        return SessionCursor(self)

    def commit(self):
        if self.pending is not None:
            self.committed.clear()
            self.committed.update(self.pending)
        self.snapshot = None
        self.pending = None

    def rollback(self):
        if self.reset_fails:
            raise OSError("connection lost during rollback")
        self.snapshot = None
        self.pending = None

    def ping(self, reconnect=True):
        if self.closed:
            raise OSError("connection is closed")

    def close(self):
        self.closed = True


class SessionCursor:
    def __init__(self, connection):
        self.connection = connection
        self.rows = []
        self.lastrowid = 1

    def execute(self, sql, params):
        conn = self.connection
        token = params[0]
        if sql == SELECT_SESSION:
            if conn.snapshot is None:
                conn.snapshot = set(conn.committed)
            self.rows = [{"id": 1}] if token in conn.snapshot else []
        elif sql in (INSERT_SESSION, REVOKE_SESSION):
            conn.pending = set(conn.committed)
            if sql == INSERT_SESSION:
                conn.pending.add(token)
            else:
                conn.pending.discard(token)
        else:
            raise AssertionError(f"Unexpected test SQL: {sql}")

    def fetchall(self):
        return self.rows

    def close(self):
        pass


class DatabasePoolTest(unittest.TestCase):
    def setUp(self):
        self.committed = set()
        self.connections = [RepeatableReadConnection(self.committed) for _ in range(2)]
        self.pool = queue.Queue(maxsize=2)
        for connection in self.connections:
            self.pool.put_nowait(connection)
        for name, value in (("DB_BACKEND", "mysql"), ("_pool", self.pool)):
            patcher = patch.object(database, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_new_login_is_visible_on_every_pooled_connection(self):
        # Both readers predate the login. MySQL retains these empty snapshots
        # unless the read transaction ends before the connection is reused.
        for _ in range(2):
            self.assertEqual(database.query(SELECT_SESSION, ("new-login",)), [])
        database.execute(INSERT_SESSION, ("new-login",))
        for _ in range(6):
            self.assertEqual(database.query(SELECT_SESSION, ("new-login",)), [{"id": 1}])

    def test_logout_is_visible_on_every_pooled_connection(self):
        self.committed.add("revoked-login")
        for _ in range(2):
            self.assertEqual(database.query(SELECT_SESSION, ("revoked-login",)), [{"id": 1}])
        database.execute(REVOKE_SESSION, ("revoked-login",))
        for _ in range(6):
            self.assertEqual(database.query(SELECT_SESSION, ("revoked-login",)), [])

    def test_failed_read_does_not_leave_a_stale_snapshot(self):
        with patch.object(SessionCursor, "fetchall", side_effect=RuntimeError("read interrupted")):
            for _ in range(2):
                with self.assertRaisesRegex(RuntimeError, "read interrupted"):
                    database.query(SELECT_SESSION, ("after-error",))
        self.committed.add("after-error")
        for _ in range(2):
            self.assertEqual(database.query(SELECT_SESSION, ("after-error",)), [{"id": 1}])

    def test_connection_that_cannot_reset_is_discarded(self):
        broken = self.connections[0]
        broken.reset_fails = True
        self.assertEqual(database.query(SELECT_SESSION, ("any-login",)), [])
        self.assertTrue(broken.closed)
        self.assertEqual(self.pool.qsize(), 1)
        self.assertIs(self.pool.get_nowait(), self.connections[1])


if __name__ == "__main__":
    unittest.main()
