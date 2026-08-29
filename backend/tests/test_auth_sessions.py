"""Regression coverage for persisted login and guest sessions."""

import importlib
import os
from pathlib import Path
import sys
import tempfile
import unittest

from fastapi import HTTPException, Response

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class AuthSessionTest(unittest.TestCase):
    def setUp(self):
        handle, self.database_path = tempfile.mkstemp(suffix=".db")
        os.close(handle)
        os.environ["DB_BACKEND"] = "sqlite"
        os.environ["SQLITE_PATH"] = self.database_path

        from app import config
        from app import database
        from app.api import auth

        config.DB_BACKEND = "sqlite"
        config.SQLITE_PATH = self.database_path
        importlib.reload(database)
        importlib.reload(auth)
        database.init_core_tables()
        self.database = database
        self.auth = auth

    def tearDown(self):
        try:
            os.remove(self.database_path)
        except FileNotFoundError:
            pass

    def test_registered_session_is_cookie_backed_and_revocable(self):
        response = Response()
        result = self.auth.register(
            self.auth.RegisterRequest(
                username="学习者",
                email="Learner@Example.com",
                password="secret123",
            ),
            response,
        )

        self.assertIn("rhyme_access_token=", response.headers["set-cookie"])
        self.assertEqual(result["user"]["email"], "learner@example.com")
        token = result["token"]
        current = self.auth.me(authorization=f"Bearer {token}")
        self.assertEqual(current["user"]["id"], result["user"]["id"])

        self.auth.logout(Response(), authorization=f"Bearer {token}")
        with self.assertRaises(HTTPException) as error:
            self.auth.me(authorization=f"Bearer {token}")
        self.assertEqual(error.exception.status_code, 401)

    def test_guest_session_uses_hash_and_expires(self):
        response = Response()
        result = self.auth.guest_login(response)
        token = result["token"]

        self.assertIn("rhyme_guest_token=", response.headers["set-cookie"])
        current = self.auth.me(authorization=f"Guest {token}")
        self.assertEqual(current["user"]["role"], "guest")
        self.assertEqual(current["user"]["remaining"], 3)

        self.database.execute(
            "UPDATE guest_sessions SET expires_at = %s WHERE id = %s",
            ("2000-01-01 00:00:00", result["user"]["session_id"]),
        )
        with self.assertRaises(HTTPException) as error:
            self.auth.me(authorization=f"Guest {token}")
        self.assertEqual(error.exception.status_code, 401)

    def test_guest_logout_revokes_the_temporary_session(self):
        response = Response()
        result = self.auth.guest_login(response)
        token = result["token"]

        self.auth.logout(Response(), authorization=f"Guest {token}")
        with self.assertRaises(HTTPException) as error:
            self.auth.me(authorization=f"Guest {token}")
        self.assertEqual(error.exception.status_code, 401)

    def test_admin_dependency_rejects_regular_user(self):
        response = Response()
        result = self.auth.register(
            self.auth.RegisterRequest(
                username="普通用户",
                email="user@example.com",
                password="secret123",
            ),
            response,
        )
        user = self.auth.me(authorization=f"Bearer {result['token']}")["user"]

        with self.assertRaises(HTTPException) as error:
            self.auth.get_admin_user(user)
        self.assertEqual(error.exception.status_code, 403)

    def test_configured_owner_is_the_only_admin(self):
        with self.assertRaises(HTTPException) as blocked:
            self.auth.register(
                self.auth.RegisterRequest(
                    username="EGOIST",
                    email="3539921167@qq.com",
                    password="secret123",
                ),
                Response(),
            )
        self.assertEqual(blocked.exception.status_code, 403)
        owner_id = self.database.insert_with_next_id(
            "users",
            {
                "username": "EGOIST",
                "email": "3539921167@qq.com",
                "password_hash": self.auth.hash_password("secret123"),
                "role": "user",
            },
        )
        regular = self.auth.register(
            self.auth.RegisterRequest(
                username="另一个用户",
                email="other@example.com",
                password="secret123",
            ),
            Response(),
        )
        self.auth.ensure_primary_admin()
        owner = self.auth.login(
            self.auth.LoginRequest(email="3539921167@qq.com", password="secret123"),
            Response(),
        )
        owner_user = self.auth.me(authorization=f"Bearer {owner['token']}")["user"]
        regular_user = self.auth.me(authorization=f"Bearer {regular['token']}")["user"]
        self.assertEqual(owner_user["role"], "admin")
        self.assertEqual(regular_user["role"], "user")
        self.assertEqual(self.auth.get_admin_user(owner_user)["email"], "3539921167@qq.com")
        with self.assertRaises(HTTPException) as error:
            self.auth.get_admin_user(regular_user)
        self.assertEqual(error.exception.status_code, 403)

    def test_password_reset_revokes_previous_sessions(self):
        registered = self.auth.register(
            self.auth.RegisterRequest(
                username="可重置用户",
                email="reset@example.com",
                password="secret123",
            ),
            Response(),
        )
        reset = self.auth.request_password_reset(self.auth.PasswordResetRequest(email="reset@example.com"))
        self.assertIn("debug_token", reset)
        self.auth.confirm_password_reset(
            self.auth.PasswordResetConfirmRequest(
                token=reset["debug_token"],
                new_password="newsecret123",
            )
        )
        with self.assertRaises(HTTPException):
            self.auth.me(authorization=f"Bearer {registered['token']}")
        logged_in = self.auth.login(
            self.auth.LoginRequest(email="reset@example.com", password="newsecret123"),
            Response(),
        )
        self.assertEqual(logged_in["user"]["email"], "reset@example.com")

    def test_legacy_id_allocation_stays_unique_for_users_and_guests(self):
        first = self.auth.register(
            self.auth.RegisterRequest(
                username="第一个用户",
                email="first@example.com",
                password="secret123",
            ),
            Response(),
        )
        second = self.auth.register(
            self.auth.RegisterRequest(
                username="第二个用户",
                email="second@example.com",
                password="secret123",
            ),
            Response(),
        )
        guest = self.auth.guest_login(Response())
        guest_two = self.auth.guest_login(Response())
        self.assertNotEqual(first["user"]["id"], second["user"]["id"])
        self.assertNotEqual(guest["user"]["session_id"], guest_two["user"]["session_id"])


if __name__ == "__main__":
    unittest.main()
