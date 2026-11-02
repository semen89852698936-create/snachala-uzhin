"""Guard all 42 no-egg pastry replacements and both public site variants."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = json.loads((ROOT / "photo-library/pastry-no-eggs-review.json").read_text(encoding="utf-8"))["photos"]
SITES = [ROOT / "index.html", ROOT / "full-catalog/index.html"]

class PastryReplacementTests(unittest.TestCase):
    def test_42_replacements_exist_and_match_manifest(self):
        self.assertEqual(len(PHOTOS), 42)
        self.assertEqual(len({p["recipe_id"] for p in PHOTOS}), 42)
        for p in PHOTOS:
            with self.subTest(recipe=p["recipe_id"]):
                self.assertTrue(p.get("visual_reviewed"))
                self.assertIn("-no-eggs.webp", p["path"])
                image = ROOT / p["path"].lstrip("/")
                self.assertTrue(image.is_file(), str(image))
                self.assertEqual(image.stat().st_size, p["bytes"])

    def test_both_catalogs_only_link_replacement_files(self):
        for path in SITES:
            html = path.read_text(encoding="utf-8")
            for p in PHOTOS:
                with self.subTest(site=str(path), recipe=p["recipe_id"]):
                    # Every record must load its own new recipe photo, never an egg-filled legacy file.
                    item = re.search(r'"id":"' + re.escape(p["recipe_id"]) + r'"[^}]*?"photo":"([^"]+)"', html)
                    self.assertIsNotNone(item)
                    self.assertEqual(item.group(1), p["path"])
                    self.assertNotIn('"photo":"' + p["old_path"] + '"', html)

if __name__ == "__main__":
    unittest.main()
