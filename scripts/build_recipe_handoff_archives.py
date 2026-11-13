#!/usr/bin/env python3
"""Verify and export frozen 10+10 recipe/photo archive without changing originals."""
from __future__ import annotations
import csv
import hashlib
import json
import subprocess
import zipfile
from collections import Counter
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO / "handoff" / "2026-11-14"
EXPECTED_GROUPS = {"01_PLOV": 10, "02_NEW_DISHES": 10}
ARCHIVES = {
    "PLOV_10_PHOTOS_10_RECIPES.zip": ("01_PLOV",),
    "NEW_DISHES_10_PHOTOS_10_RECIPES.zip": ("02_NEW_DISHES",),
    "ALL_20_PAIRS.zip": ("01_PLOV", "02_NEW_DISHES"),
}
APPROVED_IDS = {
    "nd-beef-stroganoff-mushrooms",
    "nd-beef-slow-onion",
    "nd-pork-mushrooms-sourcream",
    "nd-pork-oven-shashlik",
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def git_blob_sha(path: Path) -> str:
    return subprocess.check_output(
        ["git", "hash-object", str(path)],
        cwd=REPO, text=True
    ).strip()


def verify() -> dict:
    index = json.loads((ROOT / "MANIFEST.json").read_text(encoding="utf-8"))
    entries = index["entries"]
    assert index["total_recipes"] == index["total_photos"] == 20
    assert index["original_catalog_count"] == 1001
    assert index["original_catalog_untouched"] is True
    assert len(entries) == 20
    ids = [x["id"] for x in entries]
    assert len(set(ids)) == 20, "Duplicate recipe IDs"
    counts = Counter(x["group"] for x in entries)
    assert counts == EXPECTED_GROUPS, counts
    approved = {x["id"] for x in entries if x["user_approved_photo"]}
    assert approved == APPROVED_IDS, "Owner-approved photos mismatch"
    assert all(x["replace_recipe_id"] is None for x in entries)
    assert all(not x["ready_for_live_import"] for x in entries)

    for group, count in EXPECTED_GROUPS.items():
        folders = sorted(p for p in (ROOT / group).iterdir() if p.is_dir())
        assert len(folders) == count, f"Wrong folder count in {group}"
        for folder in folders:
            assert {p.name for p in folder.iterdir()} == {"photo.webp", "recipe.md"}, folder

    for row in entries:
        img = REPO / row["photo_file"]
        recipe = REPO / row["recipe_file"]
        assert img.is_file() and recipe.is_file(), row["id"]
        assert img.parent == recipe.parent, row["id"]
        assert img.parent.name.endswith(row["id"]), row["id"]
        with img.open("rb") as fh:
            h = fh.read(12)
        assert h[:4] == b"RIFF" and h[8:12] == b"WEBP", f"Invalid WebP {img}"
        assert img.stat().st_size >= 15000
        assert git_blob_sha(img) == row["source_image_blob_sha"], f"Photo changed: {row['id']}"
        content = recipe.read_text(encoding="utf-8")
        assert content.startswith("# " + row["title"] + "\n"), row["id"]
        assert (chr(96) + row["id"] + chr(96)) in content, row["id"]
        assert "## Приготовление по шагам" in content and "## Ингредиенты" in content, row["id"]
        assert "photo.webp" in content, row["id"]
        if row["user_approved_photo"]:
            assert "approved-collage-4" in row["source_image"]
    with (ROOT / "INDEX.csv").open(encoding="utf-8-sig", newline="") as handle:
        csv_rows = list(csv.DictReader(handle, delimiter=";"))
    assert len(csv_rows) == 20, "CSV must have 20 rows"
    assert [r["id"] for r in csv_rows] == ids, "CSV ordering differs from manifest"
    print("VERIFIED: 20 unique photo+recipe pairs, 4 owner-approved photos, original blob IDs, 1001 unchanged")
    return index


def write_zip(target: Path, selected_groups: tuple[str, ...]) -> dict:
    files = [ROOT / n for n in ("README.md", "INDEX.csv", "MANIFEST.json")]
    for group in selected_groups:
        files += sorted(p for p in (ROOT / group).rglob("*") if p.is_file())
    assert len(files) == 3 + 20 * len(selected_groups), (target.name, len(files))
    with zipfile.ZipFile(target, mode="w", compression=zipfile.ZIP_DEFLATED, compresslevel=7) as z:
        for p in files:
            rel = p.relative_to(ROOT)
            zi = zipfile.ZipInfo(filename=str(rel).replace("\\", "/"), date_time=(2026, 11, 14, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = (0o100644 << 16)
            zi.create_system = 3
            z.writestr(zi, p.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=7)
    with zipfile.ZipFile(target) as check:
        assert check.testzip() is None, f"Archive corruption: {target}"
        images = [n for n in check.namelist() if n.endswith("/photo.webp")]
        recipes = [n for n in check.namelist() if n.endswith("/recipe.md")]
        assert len(images) == len(recipes) == 10 * len(selected_groups)
    print(f"CREATED {target.name}: {len(images)} photos, {len(recipes)} recipes")
    return {
        "file": str(target.relative_to(REPO)),
        "sha256": sha256(target),
        "size": target.stat().st_size,
        "photos": len(images),
        "recipes": len(recipes)
    }


def main() -> None:
    manifest = verify()
    reports = [write_zip(ROOT / name, groups) for name, groups in ARCHIVES.items()]
    checksum_text = "".join(f'{r["sha256"]}  {Path(r["file"]).name}\n' for r in reports)
    (ROOT / "SHA256SUMS.txt").write_text(checksum_text, encoding="utf-8")
    report = {
        "archive": manifest["archive_id"],
        "content_includes": "each pair contains separate photo.webp and recipe.md",
        "catalog_modified": False,
        "source_branch": "handoff/20-recipe-photo-pairs-20261114",
        "archives": reports
    }
    (ROOT / "ARCHIVE_REPORT.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
