#!/usr/bin/env python3
"""Extract every recipe from local index.html; prepare image research queue.
Does not select or publish photos automatically.
Usage: python3 tools/build_photo_queue.py [index.html] [output.csv]
"""
import csv
import html
import json
from pathlib import Path
import re
import sys
from urllib.parse import quote

SOURCE = Path(sys.argv[1] if len(sys.argv)>1 else "index.html")
DEST = Path(sys.argv[2] if len(sys.argv)>2 else "audit/photo-research-queue.csv")
page = SOURCE.read_text(encoding="utf-8")
match = re.search(r'<script[^>]*id=["\\\']recipeData["\\\'][^>]*>(.*?)</script>', page, re.S)
if not match:
    raise SystemExit("recipeData JSON block not found; check source HTML")
items = json.loads(match.group(1))
if not isinstance(items, list) or len(items) != 1001:
    raise SystemExit(f"Expected 1001 recipes; got {len(items) if isinstance(items,list) else 'invalid data'}")
seen=set()
DEST.parent.mkdir(parents=True,exist_ok=True)
with DEST.open("w",encoding="utf-8",newline="") as output:
    w=csv.writer(output)
    w.writerow(["recipe_id","recipe_title","category","current_photo","commons_search","pexels_search","unsplash_search","candidate_url","photographer","license","license_source_url","visual_match","approval_status","notes"])
    for recipe in items:
        rid=str(recipe.get("id","")).strip()
        if not rid or rid in seen: raise SystemExit("Missing or duplicate recipe ID: "+rid)
        seen.add(rid)
        title=str(recipe.get("title","")).strip()
        if not title: raise SystemExit("Missing title: "+rid)
        q=quote(title)
        w.writerow([rid,title,recipe.get("category",""),recipe.get("photo",""),
                    "https://commons.wikimedia.org/w/index.php?search="+q+"&title=Special:MediaSearch&type=image",
                    "https://www.pexels.com/search/"+q+"/",
                    "https://unsplash.com/s/photos/"+q,
                    "","","","","","needs_review",""])
print(f"Created {DEST} with {len(items)} rows. Images not licensed or approved yet.")
