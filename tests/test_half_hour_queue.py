"""Regression tests for the half-hour archive checkpoint guard."""
import importlib.util
import unittest
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "scripts" / "check_half_hour_queue.py"
spec = importlib.util.spec_from_file_location("archive_queue_guard", path)
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class ArchiveQueueTests(unittest.TestCase):
    def setUp(self):
        self.sha = "a" * 64
        self.checkpoint = {"results": {"dish": {"status": "technical_pass", "sha256": self.sha}}, "technically_verified": 1}
        self.row = {"number": 6, "recipe_id": "dish", "technical_status": "technical_pass", "technical_sha256": self.sha, "editorial_status": "requires_visual_review", "license_status": "requires_individual_verification"}

    def test_valid_archived_copy_not_auto_approved(self):
        self.assertEqual(guard.validate({"first_50": [self.row]}, self.checkpoint), [])

    def test_mismatched_hash_is_rejected(self):
        row = dict(self.row, technical_sha256="b" * 64)
        self.assertTrue(any("hash" in e for e in guard.validate({"first_50": [row]}, self.checkpoint)))

    def test_duplicate_number_is_rejected(self):
        row2 = dict(self.row, recipe_id="other", technical_status="not_checked", number=6)
        self.assertTrue(any("Duplicate number" in e for e in guard.validate({"first_50": [self.row, row2]}, self.checkpoint)))

    def test_archive_cannot_inherit_editorial_approval(self):
        row = dict(self.row, editorial_status="approved")
        self.assertTrue(any("editorial approval" in e for e in guard.validate({"first_50": [row]}, self.checkpoint)))


if __name__ == "__main__":
    unittest.main()
