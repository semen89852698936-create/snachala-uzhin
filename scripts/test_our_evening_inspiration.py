"""Regression check: Our Evening inspiration must show the SAME recipe asset as catalog."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
IDS = ("salmon-lemon", "collection-pasta-01-03", "chocolate-cake")

class OurEveningPhotoParity(unittest.TestCase):
    def test_cards_use_exact_catalog_image_paths(self):
        for recipe_id in IDS:
            with self.subTest(recipe=recipe_id):
                catalog = re.search(
                    r'"id":"' + re.escape(recipe_id) + r'"[^}]*?"photo":"([^"]+)"',
                    HTML,
                )
                self.assertIsNotNone(catalog, f"Recipe {recipe_id} missing")
                card = re.search(
                    r'<a class="du-evening-inspiration-card" href="#recipe='
                    + re.escape(recipe_id)
                    + r'"><img src="([^"]+)"',
                    HTML,
                )
                self.assertIsNotNone(card, f"Inspiration card {recipe_id} missing")
                self.assertEqual(catalog.group(1), card.group(1))
                self.assertTrue((ROOT / card.group(1).lstrip("/")).is_file())

    def test_no_unrelated_external_image_sources_in_inspiration_cards(self):
        grid = HTML.split('<div class="du-evening-inspiration-grid">', 1)[1].split("</div>", 1)[0]
        self.assertNotIn("images.pexels.com", grid)
        self.assertNotIn("images.unsplash.com", grid)

if __name__ == "__main__":
    unittest.main()
