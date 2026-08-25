"""Regression coverage for background knowledge-map package generation."""

from copy import deepcopy
from pathlib import Path
import json
import sys
from threading import Lock
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class KnowledgeMapPackGenerationTest(unittest.TestCase):
    def test_pack_skips_cache_limits_concurrency_and_keeps_partial_success(self):
        from app.api import artifacts as api
        from app.services.generation_jobs import get_generation_job

        nodes = [
            {"id": "core", "label": "递归", "role": "core"},
            {"id": "cached", "label": "边界", "role": "branch"},
            {"id": "first", "label": "调用过程", "role": "branch"},
            {"id": "second", "label": "调用过程", "role": "branch"},
            {"id": "fails", "label": "易错点", "role": "branch"},
        ]
        state = {
            "id": 17,
            "user_id": 3,
            "kind": "map",
            "status": "saved",
            "content": {
                "schema_version": 2,
                "nodes": nodes,
                "edges": [],
                "learning_path": [],
                "deep_maps": {
                    "cached": {
                        "generation_source": "agent",
                        "content_version": 2,
                        "source_fingerprint": "fp-cached",
                    },
                },
            },
        }
        activity_lock = Lock()
        active = 0
        max_active = 0
        generated: list[str] = []

        def fake_get_artifact(artifact_id, user_id):
            self.assertEqual((artifact_id, user_id), (17, 3))
            return deepcopy(state)

        def fake_fingerprint(node, _parent_map):
            return f"fp-{node['id']}"

        def fake_generate(source_node, **_kwargs):
            nonlocal active, max_active
            node_id = source_node["id"]
            with activity_lock:
                active += 1
                max_active = max(max_active, active)
            try:
                time.sleep(0.06)
                generated.append(node_id)
                if node_id == "fails":
                    raise RuntimeError("model unavailable")
                return {
                    "source_node_id": node_id,
                    "title": source_node["label"],
                    "summary": "ready",
                    "nodes": [],
                    "edges": [],
                    "learning_path": [],
                    "generation_source": "agent",
                    "content_version": 2,
                    "source_fingerprint": f"fp-{node_id}",
                }
            finally:
                with activity_lock:
                    active -= 1

        def fake_update(artifact_id, user_id, content):
            self.assertEqual((artifact_id, user_id), (17, 3))
            state["content"] = json.loads(content)
            return deepcopy(state)

        patches = (
            patch.object(api, "get_artifact", side_effect=fake_get_artifact),
            patch.object(api, "knowledge_map_deep_dive_fingerprint", side_effect=fake_fingerprint),
            patch.object(api, "generate_knowledge_map_deep_dive", side_effect=fake_generate),
            patch.object(api, "normalize_edited_knowledge_map", side_effect=lambda value: value),
            patch.object(api, "update_knowledge_map_content", side_effect=fake_update),
            patch.object(api, "_knowledge_map_deep_dive_context", return_value=("question", "answer", [])),
        )
        for mocked in patches:
            mocked.start()
            self.addCleanup(mocked.stop)

        response = api.generate_knowledge_map_deep_dive_pack(
            17,
            api.GenerateKnowledgeMapPackRequest(user_id=3),
        )
        job_id = response["job"]["job_id"]
        progress_samples = []
        deadline = time.time() + 5
        while time.time() < deadline:
            snapshot = get_generation_job(job_id, 3)
            self.assertIsNotNone(snapshot)
            progress_samples.append(snapshot.get("progress", {}))
            if snapshot["status"] in {"completed", "failed"}:
                break
            time.sleep(0.01)
        else:
            self.fail("knowledge-map package job did not finish")

        self.assertEqual(snapshot["status"], "completed")
        result = snapshot["result"]
        self.assertEqual(result["total"], 4)
        self.assertEqual(result["ready"], 3)
        self.assertEqual(set(result["completed_node_ids"]), {"first", "second"})
        self.assertEqual(result["failed_nodes"], [{"node_id": "fails", "label": "易错点"}])
        self.assertNotIn("cached", generated)
        self.assertLessEqual(max_active, 2)
        self.assertGreaterEqual(max_active, 2)
        self.assertEqual(set(state["content"]["deep_maps"]), {"cached", "first", "second"})

        ready_samples = [sample.get("ready", 0) for sample in progress_samples]
        self.assertEqual(ready_samples, sorted(ready_samples))
        self.assertTrue(any(sample.get("current_labels") for sample in progress_samples))
        self.assertTrue(all(len(sample.get("current_labels", [])) <= 2 for sample in progress_samples))


if __name__ == "__main__":
    unittest.main()
