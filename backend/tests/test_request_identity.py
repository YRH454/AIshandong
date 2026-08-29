"""Coverage for the API-wide session ownership guard."""

import asyncio
import json
from pathlib import Path
import sys
import unittest

from fastapi import HTTPException
from starlette.requests import Request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def make_request(method: str, body: dict | None = None, query_string: str = "", origin: str | None = None) -> Request:
    raw = json.dumps(body or {}).encode("utf-8")
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": raw, "more_body": False}

    headers = [(b"content-type", b"application/json")]
    if origin:
        headers.append((b"origin", origin.encode("utf-8")))
    return Request(
        {
            "type": "http",
            "method": method,
            "path": "/api/v1/tutor/chat",
            "query_string": query_string.encode("utf-8"),
            "headers": headers,
        },
        receive,
    )


class RequestIdentityGuardTest(unittest.TestCase):
    def setUp(self):
        from app.api.auth import enforce_registered_request

        self.guard = enforce_registered_request
        self.user = {"id": 7, "username": "learner", "role": "user"}

    def test_matching_body_and_query_ids_are_allowed(self):
        request = make_request("POST", {"user_id": 7}, "user_id=7")
        result = asyncio.run(self.guard(request, self.user))
        self.assertEqual(result, self.user)
        self.assertEqual(request.state.current_user["id"], 7)

    def test_mismatched_body_id_is_rejected(self):
        request = make_request("POST", {"user_id": 8})
        with self.assertRaises(HTTPException) as error:
            asyncio.run(self.guard(request, self.user))
        self.assertEqual(error.exception.status_code, 403)

    def test_mismatched_query_id_is_rejected(self):
        request = make_request("GET", None, "user_id=8")
        with self.assertRaises(HTTPException) as error:
            asyncio.run(self.guard(request, self.user))
        self.assertEqual(error.exception.status_code, 403)

    def test_duplicate_query_ids_cannot_bypass_the_guard(self):
        request = make_request("GET", None, "user_id=7&user_id=8")
        with self.assertRaises(HTTPException) as error:
            asyncio.run(self.guard(request, self.user))
        self.assertEqual(error.exception.status_code, 403)

    def test_guest_is_not_allowed_on_persistent_routers(self):
        request = make_request("POST", {"user_id": 0})
        with self.assertRaises(HTTPException) as error:
            asyncio.run(self.guard(request, {"id": 0, "username": "游客", "role": "guest"}))
        self.assertEqual(error.exception.status_code, 403)

    def test_unconfigured_browser_origin_is_rejected(self):
        request = make_request("POST", {"user_id": 7}, origin="https://other.example")
        with self.assertRaises(HTTPException) as error:
            asyncio.run(self.guard(request, self.user))
        self.assertEqual(error.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
