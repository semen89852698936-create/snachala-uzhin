#!/usr/bin/env python3
"""Offline regression tests for the 14-recipe regeneration job: no network calls."""
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import regenerate_poultry_candidates as regen

class CandidateRegenerationTests(unittest.TestCase):
    def test_queue_is_exactly_14_and_originals_exist(self):
        items = regen.read_queue()
        self.assertEqual(tuple(items), regen.EXPECTED)
        self.assertEqual(len(items), 12)
        self.assertTrue(all("готов" in v["prompt_ru"].lower() for v in items.values()))
        self.assertTrue(all(v["approved_for_publication"] is False for v in items.values()))

    def test_reservation_is_exactly_once(self):
        item = regen.read_queue()[147]
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            paths = (base / "candidate.webp", base / "candidate.json",
                     base / "reservation.json", base / "raw.png")
            with mock.patch.object(regen, "paths", return_value=paths):
                regen.reserve(item)
                first = json.loads(paths[2].read_text())
                regen.reserve(item)
                second = json.loads(paths[2].read_text())
                self.assertEqual(first, second)
                self.assertEqual(first["attempt_number"], 1)
                self.assertEqual(first["status"], "reserved_before_paid_call")
                with self.assertRaisesRegex(RuntimeError, "credentials missing"):
                    with mock.patch.dict(os.environ, {"PHOTO_COST_APPROVED":"true", "YANDEX_API_KEY":"", "YANDEX_FOLDER_ID":""}):
                        regen.perform(item)
                self.assertFalse(paths[0].exists())

    def test_simulated_paid_result_is_candidate_only(self):
        item = regen.read_queue()[148]
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            paths = (base/"candidate.webp", base/"candidate.json",
                     base/"reservation.json", base/"raw.png")
            image = Image.new("RGB", (1536, 1024), (214, 180, 150))
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
            with mock.patch.object(regen, "paths", return_value=paths):
                regen.reserve(item)
                with mock.patch.dict(os.environ, {"PHOTO_COST_APPROVED":"true", "YANDEX_API_KEY":"test-key", "YANDEX_FOLDER_ID":"test-folder"}):
                    with mock.patch.object(regen.art, "request_image", return_value=buffer.getvalue()) as api_mock:
                        regen.perform(item)
                        self.assertEqual(api_mock.call_count, 1)
                metadata = json.loads(paths[1].read_text())
                self.assertEqual(metadata["status"], "generated_candidate_unpublished")
                self.assertFalse(metadata["approved_for_publication"])
                self.assertFalse(metadata["site_updated"])
                self.assertTrue(paths[0].exists())
                self.assertFalse(paths[3].exists())
                with self.assertRaisesRegex(RuntimeError, "Refusing to retry"):
                    regen.perform(item)

if __name__ == "__main__":
    unittest.main()
