"""Free-stock indexing tests. All HTTP calls are mocked."""
import argparse
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import pexels_search


class PexelsSearchTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        self.manifest = self.folder / "recipes.json"
        records = [{"id": "recipe-%04d" % i, "title": "Суп с томатами %d" % i}
                   for i in range(1, 1002)]
        self.manifest.write_text(json.dumps({"recipes": records}, ensure_ascii=False))
        self.output = self.folder / "stock"

    def arguments(self, execute=False):
        return argparse.Namespace(manifest=str(self.manifest),
                                  output=str(self.output), batch_size=2, execute=execute)

    def test_dry_run_does_not_create_files(self):
        self.assertEqual(pexels_search.run(self.arguments()), 0)
        self.assertFalse(self.output.exists())

    def test_missing_key_blocks_search(self):
        with patch.dict(os.environ, {"PEXELS_API_KEY": ""}):
            with self.assertRaisesRegex(ValueError, "PEXELS_API_KEY"):
                pexels_search.run(self.arguments(True))

    def test_resumes_without_duplicate_api_queries(self):
        candidate = {"photo_id": 123, "page_url": "https://www.pexels.com/photo/test-123/",
                     "photographer": "Test photographer", "source": "Pexels",
                     "license": "Pexels License", "status": "candidate_unreviewed",
                     "downloaded": False, "approved": False}
        with patch.dict(os.environ, {"PEXELS_API_KEY": "test-only"}), \
             patch.object(pexels_search, "api_candidates",
                          return_value=([candidate], "190")) as api, \
             patch.object(pexels_search.time, "sleep"):
            self.assertEqual(pexels_search.run(self.arguments(True)), 0)
            self.assertEqual(api.call_count, 2)
            file1 = self.output / "recipe-0001.json"
            self.assertTrue(file1.exists())
            payload = json.loads(file1.read_text())
            self.assertEqual(payload["candidates"][0]["approved"], False)
            self.assertEqual(payload["candidates"][0]["downloaded"], False)
            self.assertEqual(pexels_search.run(self.arguments(True)), 0)
            self.assertEqual(api.call_count, 4)
            self.assertTrue((self.output / "recipe-0003.json").exists())

    def test_rejects_oversize_batch(self):
        a = self.arguments()
        a.batch_size = 1000
        with self.assertRaises(ValueError):
            pexels_search.run(a)


if __name__ == "__main__":
    unittest.main()
