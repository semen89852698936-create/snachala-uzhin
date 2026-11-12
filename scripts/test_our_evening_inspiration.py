"""Regression: the three approved newspaper recipe buttons link to real catalog recipes."""
from pathlib import Path
import re
import unittest
import json

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
IDS = {
    "salmon-lemon": "/assets/evening-card-salmon.webp",
    "collection-pasta-01-03": "/assets/evening-card-pasta.webp",
    "chocolate-cake": "/assets/evening-card-brownie.webp",
}

class OurEveningPhotoParity(unittest.TestCase):
    def test_approved_paper_buttons_use_approved_images_and_real_recipe_links(self):
        source = re.search(
            r'<script id="recipeData" type="application/json">([\s\S]*?)</script>', HTML
        )
        self.assertIsNotNone(source, "Main recipe catalog missing")
        recipes = {r["id"] for r in json.loads(source.group(1))}
        for recipe_id, approved_path in IDS.items():
            with self.subTest(recipe=recipe_id):
                self.assertIn(recipe_id, recipes)
                pattern = (
                    r'<a class="du-approved-cover-recipe du-evening-paper-card" '
                    r'href="#recipe=' + re.escape(recipe_id)
                    + r'"[^>]*><img src="([^"]+)"'
                )
                button = re.search(pattern, HTML)
                self.assertIsNotNone(button, f"Approved newspaper button {recipe_id} missing")
                self.assertEqual(button.group(1), approved_path)
                self.assertTrue((ROOT / approved_path.lstrip("/")).is_file())

    def test_no_external_image_sources_in_approved_paper_buttons(self):
        grid = HTML.split('<div class="du-match11-recipe-grid">', 1)[1].split("</div>", 1)[0]
        self.assertNotIn("images.pexels.com", grid)
        self.assertNotIn("images.unsplash.com", grid)

if __name__ == "__main__":
    unittest.main()
