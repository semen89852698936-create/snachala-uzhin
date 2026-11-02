#!/usr/bin/env python3
"""Regression guard: visual review records must refer to real, unchanged recipe images.

Technical checks do NOT constitute a legal or editorial approval.
"""
import hashlib
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "photo-library/visual-review-20261102-evening.json"
PHOTO_MAP = ROOT / "photo-library/ai-recipe-photo-map.json"


class VisualReviewIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.review = json.loads(REVIEW.read_text(encoding="utf-8"))
        cls.manifest = json.loads(PHOTO_MAP.read_text(encoding="utf-8"))
        cls.by_id = {p["recipe_id"]: p for p in cls.manifest["photos"]}

    def test_manifest_contains_1001_distinct_recipes(self):
        self.assertEqual(len(self.manifest["photos"]), 1001)
        self.assertEqual(len(self.by_id), 1001)

    def test_review_records_are_unique_and_consistent(self):
        rows = self.review["records"]
        self.assertEqual(len(rows), self.review["photosReviewed"])
        self.assertEqual(len(rows), len({r["recipe_id"] for r in rows}))
        self.assertEqual(
            self.review["notYetVisuallyReviewed"],
            self.review["totalRecipePhotosInManifest"] - len(rows),
        )
        self.assertEqual(
            sum(r["visual_status"] == "preliminary_visual_match" for r in rows),
            self.review["preliminaryVisualMatches"],
        )
        self.assertEqual(
            sum(r["visual_status"] == "visual_mismatch_needs_replacement" for r in rows),
            self.review["visualMismatches"],
        )

    def test_binary_and_metadata_match(self):
        for row in self.review["records"]:
            with self.subTest(recipe=row["recipe_id"]):
                entry = self.by_id[row["recipe_id"]]
                self.assertEqual(row["n"], entry["n"])
                self.assertEqual(row["image_path"], entry["path"])
                self.assertEqual(row["git_blob_sha"], entry["sha"])
                self.assertEqual(row["bytes"], entry["bytes"])
                data = (ROOT / row["image_path"].lstrip("/")).read_bytes()
                self.assertEqual(len(data), row["bytes"])
                self.assertTrue(data.startswith(b"RIFF") and data[8:12] == b"WEBP")
                git_sha = hashlib.sha1(
                    b"blob " + str(len(data)).encode() + b"\0" + data
                ).hexdigest()
                self.assertEqual(git_sha, row["git_blob_sha"])

    def test_no_unverified_image_is_approved(self):
        for row in self.review["records"]:
            with self.subTest(recipe=row["recipe_id"]):
                self.assertTrue(row["visually_inspected"])
                self.assertFalse(row["generation_provenance_verified"])
                self.assertFalse(row["commercial_use_rights_verified"])
                self.assertFalse(row["owner_final_approved"])
        self.assertEqual(self.review["legalApprovals"], 0)
        self.assertEqual(self.review["ownerFinalApprovals"], 0)


if __name__ == "__main__":
    unittest.main()
