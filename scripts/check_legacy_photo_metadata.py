#!/usr/bin/env python3
"""Read-only guard against treating legacy source candidates as approved photos."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def audit(summary, curated, current_map=None):
    errors = []
    warnings = []
    total = summary.get("totalRecipes")
    if total != 1001:
        errors.append("summary.totalRecipes is not 1001")
    sources = curated.get("sources", [])
    if curated.get("candidateCount") != len(sources):
        errors.append("curated candidateCount differs from sources length")
    ids = [item.get("n") for item in sources]
    if len(ids) != len(set(ids)):
        errors.append("duplicate candidate numbers")
    for item in sources:
        n = item.get("n")
        if not isinstance(n, int) or not 1 <= n <= 1001:
            errors.append(f"invalid recipe number: {n}")
        if item.get("publication_approved") and (not item.get("photo_downloaded") or not item.get("visually_approved")):
            errors.append(f"candidate {n} approved without downloaded and visually reviewed image")
        if item.get("site_published") and not item.get("publication_approved"):
            errors.append(f"candidate {n} published without publication approval")
    if summary.get("updatedAt", "") < "2026-11-17":
        warnings.append("legacy summary: not authoritative for current approval counts")
    if curated.get("updatedAt", "") < "2026-11-17":
        warnings.append("legacy curated candidates: reconcile with current AI photo map")
    if current_map is None:
        warnings.append("current image map not supplied: cannot calculate accepted remainder")
    return {"errors": errors, "warnings": warnings,
            "historical_candidates": len(sources),
            "newly_verified_files": 0, "newly_editorially_approved": 0,
            "remaining_to_final_acceptance": None}

def main():
    summary = json.loads((ROOT / "photo-library/summary.json").read_text(encoding="utf-8"))
    curated = json.loads((ROOT / "photo-library/curated-images.json").read_text(encoding="utf-8"))
    print(json.dumps(audit(summary, curated), ensure_ascii=False, indent=2))
    return bool(audit(summary, curated)["errors"])

if __name__ == "__main__":
    raise SystemExit(main())
