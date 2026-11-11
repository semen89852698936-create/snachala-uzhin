#!/usr/bin/env python3
"""Read-only check: historic photo candidates must never masquerade as approved images."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def validate(summary, curated):
    assert summary["totalRecipes"] == 1001
    sources = curated["sources"]
    assert curated["candidateCount"] == len(sources)
    assert len({s["n"] for s in sources}) == len(sources)
    errors = []
    for s in sources:
        if s.get("publication_approved") and not (s.get("photo_downloaded") and s.get("visually_approved")):
            errors.append(f'#{s["n"]}: publication without downloaded/visual approval')
        if s.get("site_published") and not s.get("publication_approved"):
            errors.append(f'#{s["n"]}: published without approval')
    return errors

if __name__ == "__main__":
    summary = json.loads((ROOT / "photo-library/summary.json").read_text())
    curated = json.loads((ROOT / "photo-library/curated-images.json").read_text())
    issues = validate(summary, curated)
    print(f'Historic candidates: {len(curated["sources"])}; unsafe approval flags: {len(issues)}')
    if issues:
        raise SystemExit("\n".join(issues))
