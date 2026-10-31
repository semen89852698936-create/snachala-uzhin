#!/usr/bin/env python3
"""Create structured photo-library registry from the canonical embedded recipeData JSON.
No images are approved, downloaded, or published by this process.
"""
import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import quote

SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("index.html")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("photo-library")
html = SOURCE.read_text(encoding="utf-8")
m = re.search('<script id="recipeData" type="application/json">(.*?)</script>', html, re.S)
if not m:
    raise SystemExit("ERROR: recipeData block not found")
recipes = json.loads(m.group(1))
if not isinstance(recipes, list) or len(recipes) != 1001:
    raise SystemExit(f"ERROR: expected 1001 recipes, got {len(recipes) if isinstance(recipes,list) else 'non-list'}")
OUT.mkdir(exist_ok=True, parents=True)
seen = set()
rows = []
counts = Counter()
for i, recipe in enumerate(recipes, 1):
    rid = str(recipe.get("id", "")).strip()
    title = str(recipe.get("title", "")).strip()
    cat = str(recipe.get("category", "")).strip()
    if not rid or rid in seen or not title:
        raise SystemExit(f"ERROR: missing/duplicate ID or title at row {i}")
    seen.add(rid)
    counts[cat] += 1
    ingredients = recipe.get("ingredients") or []
    ingredient_names = ", ".join(str(x.get("name","")) for x in ingredients if isinstance(x,dict))
    # Plan only: neither source is an approved image.
    # Query is traceable to the real recipe title and its primary ingredients.
    q = quote(title)
    rows.append({
        "recipe_id": rid, "title": title, "category": cat,
        "minutes": recipe.get("minutes", ""),
        "ingredients": ingredient_names,
        "current_photo_id": recipe.get("photo",""),
        "image_strategy": "real_or_ai",
        "source_type": "pending",
        "candidate_image_url": "",
        "photo_author": "", "license": "", "license_evidence_url": "",
        "ai_prompt": "",
        "visual_verified": "no",
        "rights_verified": "no",
        "publication_status": "not_approved",
        "pexels_search": "https://www.pexels.com/search/" + q + "/",
        "unsplash_search": "https://unsplash.com/s/photos/" + q,
        "commons_search": "https://commons.wikimedia.org/w/index.php?search=" + q + "&title=Special:MediaSearch&type=image",
    })
fields = list(rows[0].keys())
with (OUT / "recipes-photo-registry.csv").open("w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
summary = {
    "total_recipes": len(rows),
    "unique_ids": len(seen),
    "categories": dict(sorted(counts.items())),
    "unique_current_photo_ids": len(set(str(r["current_photo_id"]) for r in rows)),
    "approved_new_images": 0,
    "status": "photo_research_queue_not_approved",
    "warning": "Search URLs are not actual photos; verify visual match and rights before publishing."
}
(OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
print(json.dumps(summary, ensure_ascii=False, indent=2))
