#!/usr/bin/env python3
"""Check legacy candidate photo records without claiming a release is approved."""
import json
import pathlib
import sys

def check(summary, curated):
    issues = []
    if summary.get("totalRecipes") != 1001:
        issues.append("unexpected_recipe_count")
    if summary.get("updatedAt", "") < curated.get("updatedAt", ""):
        issues.append("summary_older_than_curated")
    candidates = curated.get("sources", [])
    if curated.get("candidateCount") != len(candidates):
        issues.append("candidate_count_mismatch")
    if len({item.get("n") for item in candidates}) != len(candidates):
        issues.append("duplicate_candidate_number")
    for item in candidates:
        n = str(item.get("n"))
        if item.get("publication_approved") and (not item.get("photo_downloaded") or not item.get("visually_approved")):
            issues.append("unsubstantiated_approval_" + n)
        if item.get("site_published") and not item.get("photo_downloaded"):
            issues.append("published_without_file_" + n)
    return issues

if __name__ == "__main__":
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    summary = json.loads((root / "photo-library/summary.json").read_text(encoding="utf-8"))
    curated = json.loads((root / "photo-library/curated-images.json").read_text(encoding="utf-8"))
    problems = check(summary, curated)
    print(json.dumps({"summaryUpdated": summary.get("updatedAt"), "candidateCount": len(curated.get("sources", [])), "issues": problems}, ensure_ascii=False))
    sys.exit(bool(problems))
