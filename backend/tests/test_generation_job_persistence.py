"""Regression coverage for restart-safe generation-job snapshots."""

import importlib
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class GenerationJobPersistenceTest(unittest.TestCase):
    def setUp(self):
        handle, self.database_path = tempfile.mkstemp(suffix=".db")
        os.close(handle)
        os.environ["DB_BACKEND"] = "sqlite"
        os.environ["SQLITE_PATH"] = self.database_path

        from app import config
        from app import database
        from app.services import generation_jobs

        config.DB_BACKEND = "sqlite"
        config.SQLITE_PATH = self.database_path
        importlib.reload(database)
        importlib.reload(generation_jobs)
        database.init_core_tables()
        self.database = database
        self.jobs = generation_jobs

    def tearDown(self):
        try:
            os.remove(self.database_path)
        except FileNotFoundError:
            pass

    def test_completed_job_can_be_read_after_memory_cache_is_cleared(self):
        job = self.jobs.submit_generation_job(
            "notes",
            7,
            lambda: {"artifact_id": 91},
        )
        deadline = time.time() + 3
        snapshot = None
        while time.time() < deadline:
            snapshot = self.jobs.get_generation_job(job["job_id"], 7)
            if snapshot and snapshot["status"] == "completed":
                break
            time.sleep(0.01)

        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot["result"], {"artifact_id": 91})
        self.jobs._jobs.clear()

        restored = self.jobs.get_generation_job(job["job_id"], 7)
        self.assertIsNotNone(restored)
        self.assertEqual(restored["status"], "completed")
        self.assertEqual(restored["result"], {"artifact_id": 91})
        self.assertIsNone(self.jobs.get_generation_job(job["job_id"], 8))


if __name__ == "__main__":
    unittest.main()
