import csv
import json
import tempfile
import unittest
from pathlib import Path
from audit_legacy_photo_registry import audit

class PhotoAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.csv, self.summary, self.curated = [root / name for name in ("registry.csv", "summary.json", "curated.json")]
        with self.csv.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["id", "status", "image_path", "review_status"])
            w.writeheader()
            for n in range(1001):
                w.writerow({"id": str(n), "status": "published" if n == 0 else "pending",
                            "image_path": "assets/approved.webp" if n == 0 else "",
                            "review_status": "owner_approved_webp_verified" if n == 0 else ""})
        self.summary.write_text(json.dumps({"totalRecipes":1001,"distinctImageFilesLocallyConfirmed":1}))
        self.curated.write_text(json.dumps({"sources":[{"photo_downloaded":False,"publication_approved":False}]}))
    def tearDown(self):
        self.temp.cleanup()
    def test_counts_and_candidate_not_approved(self):
        result = audit(self.csv, self.summary, self.curated)
        self.assertEqual(result["legacy_csv_pending"], 1000)
        self.assertEqual(result["editorially_approved_candidates"], 0)
    def test_detects_falsely_approved_candidate(self):
        self.curated.write_text(json.dumps({"sources":[{"photo_downloaded":False,"publication_approved":True}]}))
        with self.assertRaises(ValueError):
            audit(self.csv, self.summary, self.curated)
    def test_detects_duplicate_recipe_id(self):
        text = self.csv.read_text()
        self.csv.write_text(text.replace("\n1000,pending", "\n0,pending"))
        with self.assertRaises(ValueError):
            audit(self.csv, self.summary, self.curated)

if __name__ == "__main__":
    unittest.main()
