#!/usr/bin/env python3
"""Attach 14 owner-approved meat photo candidates to both site catalogs.

Must execute inside a GitHub checkout with immutable generation commit available.
This does not merge a PR, publish to Vercel, overwrite original assets, or call any paid API.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_COMMIT = "9417e60d50b12372781a9743ecbe3ad71239092d"
BASE_COMMIT = "1d00dec46f65a84f13c6bf37d89fab366522e05e"
NUMBERS = (21, 22, 23, 24, 26, 27, 28, 30, 31, 33, 34, 36, 41, 44)
SOURCE_ROOT = "photo-library/meat-regeneration-20261102"
MAP = ROOT / "photo-library/ai-recipe-photo-map.json"
CATALOGS = [ROOT / "index.html", ROOT / "full-catalog/index.html"]
RELEASE_FILE = ROOT / "photo-library/meat-14-site-release-20261103.json"

def git_show(path: str) -> bytes:
    return subprocess.check_output(["git", "show", f"{SOURCE_COMMIT}:{path}"], cwd=ROOT)

def blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()

def apply() -> None:
    data = json.loads(MAP.read_text(encoding="utf-8"))
    photos = data["photos"]
    assert len(photos) == 1001
    updates = []
    for number in NUMBERS:
        original = photos[number - 1]
        assert int(original["n"]) == number
        rid = original["recipe_id"]
        assert rid.startswith("collection-meat-"), (number, rid)
        name = f"{number:04d}-{rid}-regen.webp"
        old_path = original["path"]
        expected_old_path = f"/assets/recipes-ai/{number:04d}-{rid}.webp"
        assert old_path == expected_old_path, (number, old_path)
        candidate = git_show(f"{SOURCE_ROOT}/photos/{name}")
        metadata = json.loads(git_show(f"{SOURCE_ROOT}/records/{name[:-5]}.json"))
        assert metadata["n"] == number and metadata["recipe_id"] == rid
        assert metadata["status"] == "generated_candidate_unpublished"
        assert metadata["approved_for_publication"] is False
        assert metadata["sha256"] == hashlib.sha256(candidate).hexdigest()
        assert metadata["bytes"] == len(candidate)
        assert len(candidate) > 20000 and candidate[:4] == b"RIFF" and candidate[8:12] == b"WEBP"
        dest_path = f"/assets/recipes-ai/{name}"
        dest = ROOT / dest_path.lstrip("/")
        assert not dest.exists(), (number, "Refusing to overwrite candidate destination")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(candidate)
        original.update(path=dest_path, sha=blob_sha(candidate), bytes=len(candidate))
        updates.append({
            "number": number, "recipe_id": rid,
            "original_path": old_path,
            "original_blob_sha": metadata["original_git_blob_sha"],
            "new_path": dest_path,
            "new_blob_sha": original["sha"],
            "bytes": len(candidate),
            "generated_model": metadata["model"]
        })
    for catalog in CATALOGS:
        html = catalog.read_text(encoding="utf-8")
        for row in updates:
            old_path, new_path = row["original_path"], row["new_path"]
            assert html.count(old_path) == 1, (catalog, row["number"], html.count(old_path))
            assert new_path not in html, (catalog, row["number"])
            html = html.replace(old_path, new_path)
        catalog.write_text(html, encoding="utf-8")
    MAP.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = {
        "schema_version": 1,
        "date": str(date(2026, 11, 3)),
        "requested_by_owner": True,
        "owner_authorized_site_publication": True,
        "publication_method": "release branch, tests, merge then separate Vercel deployment",
        "generation_commit": SOURCE_COMMIT,
        "previous_site_commit": BASE_COMMIT,
        "candidate_count": len(updates),
        "candidate_visual_editorial_quality_not_independently_approved": True,
        "old_assets_untouched": True,
        "photos": updates
    }
    RELEASE_FILE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PASS 14 meat WebP and SHA256 from pinned generation commit; both catalogs and manifest updated")

if __name__ == "__main__":
    apply()
