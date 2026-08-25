"""Regression coverage for actionable background-generation failures."""

from pathlib import Path
import sys
import time
import unittest

import httpx
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class GenerationJobFailureTest(unittest.TestCase):
    def _wait_for_terminal(self, job_id: str):
        from app.services.generation_jobs import get_generation_job

        deadline = time.time() + 3
        while time.time() < deadline:
            snapshot = get_generation_job(job_id, 41)
            if snapshot and snapshot["status"] in {"completed", "failed"}:
                return snapshot
            time.sleep(0.01)
        self.fail("generation job did not reach a terminal state")

    def test_timeout_keeps_an_actionable_retryable_error(self):
        from app.services.generation_jobs import submit_generation_job

        job = submit_generation_job("interactive", 41, lambda: (_ for _ in ()).throw(httpx.ReadTimeout("slow provider")))
        snapshot = self._wait_for_terminal(job["job_id"])

        self.assertEqual(snapshot["status"], "failed")
        self.assertEqual(snapshot["error_code"], "model_timeout")
        self.assertTrue(snapshot["retryable"])
        self.assertIn("自动重试", snapshot["error"])
        self.assertEqual(snapshot["progress"]["phase"], "failed")

    def test_missing_source_explains_that_retry_needs_a_valid_turn(self):
        from app.services.generation_jobs import submit_generation_job

        job = submit_generation_job(
            "interactive",
            41,
            lambda: (_ for _ in ()).throw(HTTPException(status_code=404, detail="没有找到这条回答，请刷新后重试")),
        )
        snapshot = self._wait_for_terminal(job["job_id"])

        self.assertEqual(snapshot["error_code"], "source_unavailable")
        self.assertFalse(snapshot["retryable"])
        self.assertIn("没有找到这条回答", snapshot["error"])


if __name__ == "__main__":
    unittest.main()
