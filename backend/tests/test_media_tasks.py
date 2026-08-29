"""Regression coverage for ownership-bound provider video tasks."""

import importlib
import os
from pathlib import Path
import sys
import tempfile
import unittest

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class MediaTaskTest(unittest.TestCase):
    def setUp(self):
        handle, self.database_path = tempfile.mkstemp(suffix=".db")
        os.close(handle)
        os.environ["DB_BACKEND"] = "sqlite"
        os.environ["SQLITE_PATH"] = self.database_path

        from app import config, database
        from app import migrations
        from app.services import media_db
        from app.api import media

        config.DB_BACKEND = "sqlite"
        config.SQLITE_PATH = self.database_path
        importlib.reload(database)
        importlib.reload(migrations)
        importlib.reload(media_db)
        importlib.reload(media)
        database.init_core_tables()
        migrations.run_migrations()
        self.database = database
        self.media_db = media_db
        self.media = media

    def tearDown(self):
        try:
            os.remove(self.database_path)
        except FileNotFoundError:
            pass

    def test_migrations_are_repeatable_and_recorded(self):
        from app.migrations import run_migrations

        run_migrations()
        run_migrations()
        tables = self.database.query(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('schema_migrations', 'video_tasks')"
        )
        self.assertEqual({row["name"] for row in tables}, {"schema_migrations", "video_tasks"})
        self.assertEqual(self.database.query("SELECT COUNT(*) AS count FROM schema_migrations")[0]["count"], 1)

    def test_video_task_is_visible_only_to_its_owner(self):
        self.media_db.create_video_task(7, "task_abc", "讲解二叉树", "1280*720", 5)
        self.assertEqual(self.media_db.get_video_task("task_abc", 7)["user_id"], 7)
        self.assertIsNone(self.media_db.get_video_task("task_abc", 8))

    def test_media_poll_rejects_another_users_task_before_provider_call(self):
        self.media_db.create_video_task(7, "task_xyz", "讲解二叉树", "1280*720", 5)
        with self.assertRaises(HTTPException) as error:
            self.media.get_video("task_xyz", {"id": 8, "role": "user"})
        self.assertEqual(error.exception.status_code, 404)

    def test_successful_poll_is_cached_after_first_download(self):
        self.media_db.create_video_task(7, "task_done", "讲解二叉树", "1280*720", 5)
        original_query = self.media.query_wan_video
        original_download = self.media._download_to_static
        try:
            calls = {"query": 0, "download": 0}

            def query(_task_id):
                calls["query"] += 1
                return {"status": "SUCCEEDED", "video_url": "https://provider.example/video.mp4"}

            def download(*_args, **_kwargs):
                calls["download"] += 1
                return "/static/videos/video.mp4"

            self.media.query_wan_video = query
            self.media._download_to_static = download
            first = self.media.get_video("task_done", {"id": 7, "role": "user"})
            second = self.media.get_video("task_done", {"id": 7, "role": "user"})
            self.assertEqual(first["video_url"], "/static/videos/video.mp4")
            self.assertEqual(second["video_url"], "/static/videos/video.mp4")
            self.assertEqual(calls, {"query": 1, "download": 1})
        finally:
            self.media.query_wan_video = original_query
            self.media._download_to_static = original_download


if __name__ == "__main__":
    unittest.main()
