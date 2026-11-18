import importlib.util
import pathlib
import unittest

path = pathlib.Path(__file__).with_name("check_legacy_photo_metadata.py")
spec = importlib.util.spec_from_file_location("photo_guard", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LegacyPhotoMetadataTests(unittest.TestCase):
    def setUp(self):
        self.summary = {"totalRecipes": 1001, "updatedAt": "2026-11-01"}
        self.curated = {"candidateCount": 1, "updatedAt": "2026-11-01",
                        "sources": [{"n": 21, "photo_downloaded": False,
                                     "visually_approved": False,
                                     "publication_approved": False,
                                     "site_published": False}]}
    def test_historical_candidate_is_not_approval(self):
        result = module.audit(self.summary, self.curated)
        self.assertEqual(result["errors"], [])
        self.assertIsNone(result["remaining_to_final_acceptance"])
        self.assertEqual(result["newly_verified_files"], 0)
    def test_reject_approval_without_file(self):
        self.curated["sources"][0]["publication_approved"] = True
        self.assertTrue(module.audit(self.summary, self.curated)["errors"])
    def test_reject_published_unapproved(self):
        self.curated["sources"][0]["site_published"] = True
        self.assertTrue(module.audit(self.summary, self.curated)["errors"])
    def test_reject_duplicate_ids(self):
        self.curated["sources"].append(dict(self.curated["sources"][0]))
        self.curated["candidateCount"] = 2
        self.assertTrue(module.audit(self.summary, self.curated)["errors"])

if __name__ == "__main__":
    unittest.main()
