import unittest
from check_photo_evidence import check

class PhotoEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.summary = {"totalRecipes": 1001, "updatedAt": "2026-11-01"}
        self.curated = {"updatedAt": "2026-11-01", "candidateCount": 1, "sources": [{"n": 21, "photo_downloaded": False, "visually_approved": False, "publication_approved": False, "site_published": False}]}

    def test_valid(self):
        self.assertEqual(check(self.summary, self.curated), [])

    def test_unsubstantiated_approval(self):
        self.curated["sources"][0]["publication_approved"] = True
        self.assertIn("unsubstantiated_approval_21", check(self.summary, self.curated))

    def test_duplicate(self):
        self.curated["sources"] *= 2
        self.curated["candidateCount"] = 2
        self.assertIn("duplicate_candidate_number", check(self.summary, self.curated))

    def test_stale_summary(self):
        self.curated["updatedAt"] = "2026-11-06"
        self.assertIn("summary_older_than_curated", check(self.summary, self.curated))

    def test_count_mismatch(self):
        self.curated["candidateCount"] = 3
        self.assertIn("candidate_count_mismatch", check(self.summary, self.curated))

if __name__ == "__main__":
    unittest.main()
