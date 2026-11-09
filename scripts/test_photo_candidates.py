import unittest
from check_photo_candidates import check

class PhotoCandidateTests(unittest.TestCase):
    def setUp(self):
        self.summary = {"totalRecipes": 1001}
        self.entry = {"n": 21, "photo_downloaded": False, "visually_approved": False,
                      "publication_approved": False, "site_published": False}

    def test_unapproved_source_is_not_a_file(self):
        self.assertEqual(check(self.summary, {"candidateCount": 1, "sources": [self.entry]}), [])

    def test_reject_false_approval(self):
        entry = dict(self.entry, publication_approved=True)
        self.assertTrue(check(self.summary, {"candidateCount": 1, "sources": [entry]}))

    def test_reject_duplicate_and_count_mismatch(self):
        self.assertEqual(len(check(self.summary, {"candidateCount": 1, "sources": [self.entry, self.entry]})), 2)

    def test_reject_published_unapproved(self):
        entry = dict(self.entry, site_published=True)
        self.assertTrue(check(self.summary, {"candidateCount": 1, "sources": [entry]}))

if __name__ == "__main__":
    unittest.main()
