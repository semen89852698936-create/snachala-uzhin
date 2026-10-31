#!/usr/bin/env python3
"""Validate images selected for the recipe photo library; never publish automatically."""
import csv
import json
from pathlib import Path
root = Path(__file__).resolve().parent
with (root / "recipes-photo-registry.csv").open(encoding="utf-8-sig",newline="") as f:
    records = list(csv.DictReader(f))
ids = [r["recipe_id"] for r in records]
assert len(ids) == 1001 and len(set(ids)) == 1001, "Expected 1001 unique recipes"
catalog = {r["recipe_id"]: r for r in records}
entries = json.loads((root / "curated-images.json").read_text(encoding="utf-8"))
assert isinstance(entries,list)
approved,seen = {},set()
for entry in entries:
    rid = entry["recipe_id"]
    assert rid in catalog and rid not in seen, "Unknown or duplicate recipe"
    seen.add(rid)
    assert entry["source_type"] in ("real","ai")
    file = Path(entry["image_path"])
    assert not file.is_absolute() and ".." not in file.parts and file.parts[0] == "images"
    assert file.suffix.lower() in (".webp",".jpg",".jpeg",".png",".avif")
    assert (root / file).is_file(), f"Image file missing: {file}"
    if entry.get("visual_verified") is not True or entry.get("rights_verified") is not True:
        continue
    if entry["source_type"] == "real":
        assert all(entry.get(k) for k in ("source_url","license_evidence_url","author"))
    else:
        assert entry.get("generation_note") and entry.get("checked_against_ingredients")
    approved[rid] = {"image": str(file), "alt": catalog[rid]["title"], "source_type": entry["source_type"]}
(root/"approved-images.json").write_text(json.dumps(approved,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"Entries: {len(entries)}, approved: {len(approved)}, remaining: {1001-len(approved)}")
