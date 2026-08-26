"""Regression coverage for resumable knowledge-map packages."""

import json
import importlib
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class KnowledgeMapWorkspaceProgressTest(unittest.TestCase):
    def setUp(self):
        handle, self.database_path = tempfile.mkstemp(suffix=".db")
        os.close(handle)
        os.environ["DB_BACKEND"] = "sqlite"
        os.environ["SQLITE_PATH"] = self.database_path

        from app import config
        from app import database
        from app.services import map_db

        config.DB_BACKEND = "sqlite"
        config.SQLITE_PATH = self.database_path
        importlib.reload(database)
        importlib.reload(map_db)

        self.execute = database.execute
        self.execute(
            "CREATE TABLE learning_artifacts ("
            "id INTEGER PRIMARY KEY, user_id INT, kind TEXT, status TEXT, content TEXT)"
        )
        map_db.init_tables()

    def tearDown(self):
        try:
            os.remove(self.database_path)
        except FileNotFoundError:
            pass

    def test_exploration_is_restored_pruned_and_cleared(self):
        from app.services.map_db import (
            clear_map_progress,
            get_map_progress,
            prune_map_progress,
            update_map_workspace_progress,
        )

        content = {
            "nodes": [
                {"id": "core", "label": "Recursive", "role": "core"},
                {"id": "n2", "label": "Boundary", "role": "branch"},
                {"id": "n3", "label": "Timeline", "role": "branch"},
            ],
            "deep_maps": {"n2": {"nodes": [], "edges": [], "learning_path": []}},
        }
        self.execute(
            "INSERT INTO learning_artifacts (id, user_id, kind, status, content) "
            "VALUES (%s, %s, %s, %s, %s)",
            (1, 1, "map", "saved", json.dumps(content)),
        )

        initial = get_map_progress(1, 1)
        self.assertEqual(initial["exploration"]["total_deep_dives"], 2)
        self.assertEqual(initial["exploration"]["generated_deep_dive_ids"], ["n2"])

        saved = update_map_workspace_progress(1, 1, "n3", ["n2", "n3", "missing"])
        self.assertEqual(saved["exploration"]["active_node_id"], "n3")
        self.assertEqual(saved["exploration"]["explored_node_ids"], ["n2", "n3"])
        self.assertIsNone(update_map_workspace_progress(1, 1, "missing", []))

        content["nodes"] = content["nodes"][:2]
        self.execute(
            "UPDATE learning_artifacts SET content = %s WHERE id = %s",
            (json.dumps(content), 1),
        )
        pruned = prune_map_progress(1, 1)
        self.assertEqual(pruned["exploration"]["active_node_id"], "")
        self.assertEqual(pruned["exploration"]["explored_node_ids"], ["n2"])

        clear_map_progress(1, 1)
        cleared = get_map_progress(1, 1)
        self.assertEqual(cleared["exploration"]["explored_node_ids"], [])

    def test_core_node_is_not_a_trackable_progress_atom(self):
        from app.services.map_db import get_map_progress, set_map_node_progress

        content = {
            "nodes": [
                {"id": "core", "label": "Conditional probability", "role": "core"},
                {"id": "n2", "label": "Given condition", "role": "branch"},
                {"id": "n3", "label": "Sample space", "role": "detail"},
            ],
        }
        self.execute(
            "INSERT INTO learning_artifacts (id, user_id, kind, status, content) "
            "VALUES (%s, %s, %s, %s, %s)",
            (2, 1, "map", "saved", json.dumps(content)),
        )

        self.assertIsNone(set_map_node_progress(2, 1, "core", "mastered"))
        updated = set_map_node_progress(2, 1, "n2", "mastered")
        self.assertEqual(updated["summary"], {
            "total": 2,
            "mastered": 1,
            "review": 0,
            "untouched": 1,
        })

        # Old progress records for a former core should not pollute the score.
        self.execute(
            "INSERT INTO knowledge_map_node_progress (user_id, artifact_id, node_id, status) "
            "VALUES (%s, %s, %s, %s)",
            (1, 2, "core", "mastered"),
        )
        progress = get_map_progress(2, 1)
        self.assertEqual(progress["summary"]["total"], 2)
        self.assertEqual(progress["summary"]["mastered"], 1)
        self.assertNotIn("core", progress["progress"])


if __name__ == "__main__":
    unittest.main()
