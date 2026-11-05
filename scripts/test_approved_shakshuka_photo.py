#!/usr/bin/env python3
"""Guard the owner-approved four-egg shakshuka photo against accidental rollback.

This checks file identity and recipe linkage, not visual correctness of arbitrary
future images. Any intentional replacement requires a fresh visual review.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APPROVED_BLOB = "acb6a8f5c73adba1ce50dc6594d0c05c94d1873c"
RECIPE_ID = "shakshuka"
PHOTO = "/assets/recipes-ai/0019-shakshuka-regen-20261105.webp"

photos = json.loads((ROOT / "photo-library/ai-recipe-photo-map.json").read_text(encoding="utf-8"))["photos"]
assert len(photos) == 1001, "photo map must contain all 1001 recipes"
matches = [p for p in photos if p["recipe_id"] == RECIPE_ID]
assert len(matches) == 1, "shakshuka must have exactly one photo map entry"
entry = matches[0]
assert entry["n"] == 19 and entry["path"] == PHOTO, "shakshuka mapping changed"
data = (ROOT / PHOTO.lstrip("/")).read_bytes()
blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
assert data[:4] == b"RIFF" and data[8:12] == b"WEBP", "not a WebP"
assert blob == entry["sha"] == APPROVED_BLOB, "approved shakshuka photo replaced or map stale"
assert len(data) == entry["bytes"], "photo size differs from map"

for page in ("index.html", "full-catalog/index.html"):
    html = (ROOT / page).read_text(encoding="utf-8")
    match = re.search(r'<script id="recipeData" type="application/json">(.*?)</script>', html, re.S)
    assert match, f"{page}: recipeData missing"
    recipes = json.loads(match.group(1))
    assert len(recipes) == len({p["id"] for p in recipes}) == 1001, page
    recipe = next((p for p in recipes if p["id"] == RECIPE_ID), None)
    assert recipe and recipe["photo"] == PHOTO, f"{page}: shakshuka photo mismatch"
    print(f"PASS {page}: 1001 unique recipes, approved shakshuka photo linked")
print("PASS: owner-approved shakshuka WebP and photo map unchanged")
