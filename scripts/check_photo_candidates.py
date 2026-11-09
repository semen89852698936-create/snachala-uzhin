#!/usr/bin/env python3
"""Validate historical photo candidates without conflating source links and files."""
import json
import sys
from pathlib import Path

def check(summary, curated):
    errors = []
    sources = curated.get("sources", [])
    if curated.get("candidateCount") != len(sources):
        errors.append("candidateCount differs from sources length")
    seen = set()
    for entry in sources:
        n = entry.get("n")
        if n in seen:
            errors.append(f"duplicate recipe number {n}")
        seen.add(n)
        if not isinstance(n, int) or not 1 <= n <= summary.get("totalRecipes", 0):
            errors.append(f"invalid recipe number {n}")
        if entry.get("publication_approved") and not (entry.get("photo_downloaded") and entry.get("visually_approved")):
            errors.append(f"{n}: approval without downloaded and visually reviewed file")
        if entry.get("site_published") and not entry.get("publication_approved"):
            errors.append(f"{n}: published without approval")
    return errors

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "photo-library"
    summary = json.loads((root / "summary.json").read_text(encoding="utf-8"))
    curated = json.loads((root / "curated-images.json").read_text(encoding="utf-8"))
    errors = check(summary, curated)
    print(f'historical candidates: {len(curated["sources"])}; errors: {len(errors)}')
    for error in errors:
        print(error, file=sys.stderr)
    sys.exit(bool(errors))
