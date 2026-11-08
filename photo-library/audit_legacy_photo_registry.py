#!/usr/bin/env python3
"""Read-only audit of legacy photo registry; never equate metadata with image approval."""
import csv
import json
import sys
from collections import Counter
from pathlib import Path

def audit(csv_path, summary_path, curated_path):
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    summary = json.loads(Path(summary_path).read_text(encoding="utf-8"))
    curated = json.loads(Path(curated_path).read_text(encoding="utf-8"))
    ids = [r["id"] for r in rows]
    if len(rows) != 1001 or len(set(ids)) != len(ids):
        raise ValueError("Expected 1001 unique recipe IDs")
    if summary["totalRecipes"] != len(rows):
        raise ValueError("Summary recipe count differs from CSV")
    statuses = Counter(r["status"] for r in rows)
    published = [r for r in rows if r["status"] == "published"]
    if any(not r["image_path"] or r["review_status"] != "owner_approved_webp_verified" for r in published):
        raise ValueError("Published record without verified image path and approval")
    candidates = curated.get("sources", [])
    if any(c.get("publication_approved") and not c.get("photo_downloaded") for c in candidates):
        raise ValueError("Candidate approved without downloaded image")
    return {
        "recipes": len(rows),
        "legacy_csv_published": len(published),
        "legacy_csv_pending": statuses["pending"],
        "legacy_confirmed_local_webp": summary["distinctImageFilesLocallyConfirmed"],
        "source_page_candidates": len(candidates),
        "downloaded_from_candidate_list": sum(bool(c.get("photo_downloaded")) for c in candidates),
        "editorially_approved_candidates": sum(bool(c.get("publication_approved")) for c in candidates),
        "not_final_in_legacy_csv": len(rows) - len(published),
        "caution": "Legacy registry is not the current AI photo map; these counts must not replace physical file inventory or visual review."
    }

if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit("Usage: audit_legacy_photo_registry.py CSV SUMMARY CURATED")
    print(json.dumps(audit(*sys.argv[1:]), ensure_ascii=False, indent=2))
