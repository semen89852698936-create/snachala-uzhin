import tempfile
import unittest
from pathlib import Path
from scripts.reconcile_photo_evidence_20261107 import reconcile

class PhotoEvidenceTests(unittest.TestCase):
    def test_current_repository_data(self):
        result = reconcile()
        self.assertEqual(result["mapped_webp_records"], 1001)
        self.assertEqual(result["new_approvals"], 0)

    def test_missing_registry_is_not_counted_as_approval(self):
        result = reconcile()
        self.assertEqual(result["unapproved_current_map_records"], 1001)
        self.assertGreaterEqual(result["source_page_candidates"], 0)

if __name__ == "__main__":
    unittest.main()
