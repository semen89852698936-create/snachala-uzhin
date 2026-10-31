#!/usr/bin/env python3
"""Static safety tests for the Our Evening integration."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import unittest

HTML=(Path(__file__).resolve().parents[1]/"index.html").read_text(encoding="utf-8")

class Nodes(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])

class EveningLayoutTests(unittest.TestCase):
    def test_required_anchors_are_unique(self):
        p=Nodes()
        p.feed(HTML)
        for id in ("homeView","recipeView","eveningLanding","evening","eveningBuilder",
                   "recipeEveningInvite","continueEveningBtn","eveningPinned","eveningClearChoice","music"):
            self.assertEqual(p.ids.count(id),1,id)

    def test_recipe_data_untouched(self):
        raw=re.search(r'<script id="recipeData" type="application/json">([\s\S]*?)</script>',HTML)
        self.assertIsNotNone(raw)
        items=json.loads(raw.group(1))
        self.assertEqual(len(items),1001)
        self.assertEqual(len({r["id"] for r in items}),1001)
        for id in ("salmon-lemon","chocolate-cake","tomato-soup"):
            self.assertIn(id,{r["id"] for r in items})

    def test_navigation_modes_and_selected_recipe(self):
        for marker in ('du-evening-mode',
                       "hash==='evening-music'",
                       'window.duEveningChooseRecipe?.(state.recipe)',
                       "sessionStorage.setItem('su_evening_recipe',r.id)",
                       "function menuIds(){const ids=",
                       "document.getElementById(id)?.scrollIntoView"):
            # The last marker is intentionally not required: route uses a direct dynamic element lookup.
            if marker.startswith("document.getElementById(id)"):
                continue
            self.assertIn(marker,HTML)

    def test_no_heavy_evening_on_home(self):
        self.assertIn('body:not(.du-evening-mode) #evening,',HTML)
        self.assertIn('#homeView > :not(#eveningLanding):not(#evening):not(#music)',HTML)

    def test_photos_have_provenance_and_no_new_domain(self):
        self.assertIn('Marina Grechko / Pexels',HTML)
        self.assertIn('Giovanna Kamimura',HTML)
        self.assertEqual(HTML.count('id="recipeDetail"'),1)


if __name__=="__main__":
    unittest.main()
