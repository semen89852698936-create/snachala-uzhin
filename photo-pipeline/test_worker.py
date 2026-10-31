"""Tests deliberately use mocks; never call a billable image API."""
import argparse
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import worker


def recipes():
    return [{"id": f"recipe-{i:04d}", "title": f"Тестовое блюдо {i}",
             "description": "Готовое блюдо", "ingredients": ["Картофель", "Соль"],
             "plating": "Подать тёплым"} for i in range(1, 1002)]


class PhotoWorkerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.manifest = self.base / "recipes.json"
        self.manifest.write_text(json.dumps({"recipes": recipes()}, ensure_ascii=False), encoding="utf-8")
        self.output = self.base / "photo-library"

    def args(self, **kwargs):
        args = dict(manifest=str(self.manifest), output=str(self.output),
                    max_per_run=3, max_total=2, execute=False)
        args.update(kwargs)
        return argparse.Namespace(**args)

    def test_plan_is_side_effect_free(self):
        self.assertEqual(worker.run(self.args()), 0)
        self.assertFalse(self.output.exists())

    def test_paid_run_requires_key(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
            with self.assertRaisesRegex(RuntimeError, "OPENAI_API_KEY"):
                worker.run(self.args(execute=True))
        self.assertFalse(self.output.exists())

    def test_caps_checkpoint_and_resume(self):
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-only"}), \
             patch.object(worker, "request_image", return_value=(b"FAKE_TEST_BYTES", 1536, 1024)) as api, \
             patch.object(worker.time, "sleep"):
            self.assertEqual(worker.run(self.args(execute=True)), 0)
            self.assertEqual(api.call_count, 2)
            stats = worker.summarize(recipes(), self.output)
            self.assertEqual(stats["generated"], 2)
            self.assertEqual(stats["approved"], 0)
            self.assertEqual(stats["review_needed"], 2)
            self.assertEqual(stats["pending"], 999)
            self.assertEqual(worker.run(self.args(execute=True)), 0)
            self.assertEqual(api.call_count, 2, "resuming must not duplicate paid calls")
            record = json.loads((self.output / "records/recipe-0001.json").read_text())
            self.assertEqual(record["status"], "generated_pending_review")

    def test_rejects_duplicate_recipe_ids(self):
        invalid = recipes()
        invalid[1]["id"] = invalid[0]["id"]
        self.manifest.write_text(json.dumps({"recipes": invalid}, ensure_ascii=False))
        with self.assertRaisesRegex(ValueError, "distinct recipes"):
            worker.run(self.args())

    def test_prompt_is_specific(self):
        text = worker.make_prompt(recipes()[0])
        self.assertIn("Картофель", text)
        self.assertNotIn("Core ingredients: Картофель, Соль", text)
        self.assertIn("Тестовое блюдо 1", text)


if __name__ == "__main__":
    unittest.main()
