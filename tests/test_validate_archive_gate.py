"""Regression tests for the archive gate's fail-closed rules."""
import json
import tempfile
import unittest
from pathlib import Path
from scripts.validate_archive_gate import validate


class GateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "gate.json"
        self.record = dict(number=46, recipe_id="test", recipe_title="Тефтели",
                           source_page="https://example.org/photo",
                           technical_status="not_checked",
                           editorial_status="hold_for_visual_recipe_comparison",
                           rights_status="individual_license_and_attribution_unverified",
                           evidence_scope="source_filename_and_queue_metadata_only")

    def check(self, record, **extra):
        self.path.write_text(json.dumps(dict(records=[record], **extra)), encoding="utf-8")
        return validate(self.path)

    def test_non_object_json_root_rejected_without_crash(self):
        for payload in ("null", "[]", "\"text\"", "42"):
            with self.subTest(payload=payload):
                self.path.write_text(payload, encoding="utf-8")
                self.assertIn("top-level JSON object required", " ".join(validate(self.path)))

    def test_pending_record_passes(self):
        self.assertEqual([], self.check(self.record, manual_visual_approved=0, rights_cleared=0))

    def test_metadata_cannot_clear_rights(self):
        self.assertTrue(self.check(dict(self.record, rights_status="cleared"), rights_cleared=0))

    def test_metadata_cannot_approve_visual(self):
        self.assertTrue(self.check(dict(self.record, editorial_status="approved"), manual_visual_approved=0))

    def test_archived_owner_replacement_is_not_approved(self):
        self.assertTrue(self.check(dict(self.record, number=20, editorial_status="approved")))

    def test_duplicate_number_rejected(self):
        self.path.write_text(json.dumps(dict(records=[self.record, self.record])), encoding="utf-8")
        self.assertTrue(self.check_duplicates())

    def check_duplicates(self):
        return validate(self.path)


if __name__ == "__main__":
    unittest.main()
