#!/usr/bin/env python3
"""Read-only reconciliation of the historical photo register and the current AI map."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def reconcile(root=ROOT):
    with (root / "photo-library/ai-recipe-photo-map.json").open(encoding="utf-8") as f:
        mapping = json.load(f)
    with (root / "photo-library/summary.json").open(encoding="utf-8") as f:
        historical = json.load(f)
    with (root / "photo-library/curated-images.json").open(encoding="utf-8") as f:
        curated = json.load(f)
    photos = mapping["photos"]
    numbers = [p["n"] for p in photos]
    paths = [p["path"] for p in photos]
    ids = [p["recipe_id"] for p in photos]
    assert len(photos) == mapping["total"] == 1001
    assert sorted(numbers) == list(range(1, 1002)), "Missing or duplicate recipe number"
    assert len(set(paths)) == len(photos), "Duplicate image path"
    assert len(set(ids)) == len(photos), "Duplicate recipe id"
    assert all(p["bytes"] > 0 and p["path"].endswith(".webp") and p.get("sha") for p in photos)
    candidates = curated["sources"]
    assert len(candidates) == curated["candidateCount"]
    assert len({p["n"] for p in candidates}) == len(candidates)
    assert all(not p.get("publication_approved") or
               (p.get("photo_downloaded") and p.get("visually_approved"))
               for p in candidates), "Unsubstantiated publication approval"
    return {
        "mapped_webp_records": len(photos),
        "historical_summary_updated": historical["updatedAt"],
        "historical_local_files": historical["distinctImageFilesLocallyConfirmed"],
        "source_page_candidates": len(candidates),
        "new_files_created_by_this_check": 0,
        "new_visual_checks": 0,
        "new_legal_checks": 0,
        "new_approvals": 0,
        "unapproved_current_map_records": len(photos),
        "note": "Mapping metadata is not evidence of physical bytes, legal rights or editorial approval."
    }

if __name__ == "__main__":
    print(json.dumps(reconcile(), ensure_ascii=False, indent=2))
