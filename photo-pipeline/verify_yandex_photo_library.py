#!/usr/bin/env python3
"""Verify generated images against the real 1001-recipe catalog and checkpoint progress.

This never publishes or approves images. It only counts complete, intact WebP files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "photo-library" / "recipes.json"
PHOTO_BASE = ROOT / "photo-library" / "alice-ai-art"
EXPECTED_SIZE = (1200, 900)


def report_status(manifest=MANIFEST, photo_base=PHOTO_BASE):
    recipes = json.loads(Path(manifest).read_text(encoding="utf-8"))["recipes"]
    if len(recipes) != 1001 or len({r["id"] for r in recipes}) != 1001:
        raise ValueError("Expected 1001 unique recipes")
    directory = Path(photo_base)
    completed = []
    missing = []
    problems = []
    digests = {}
    for recipe in sorted(recipes, key=lambda r: int(r["n"])):
        ident = f'{int(recipe["n"]):04d}-{recipe["id"]}'
        photo = directory / "photos" / (ident + ".webp")
        record_path = directory / "records" / (ident + ".json")
        if not photo.exists() and not record_path.exists():
            missing.append(int(recipe["n"]))
            continue
        if not photo.exists() or not record_path.exists():
            problems.append(f"{ident}: photo/record mismatch")
            continue
        try:
            record = json.loads(record_path.read_text(encoding="utf-8"))
            if record.get("recipe_id") != recipe["id"] or int(record.get("n", -1)) != int(recipe["n"]):
                raise ValueError("Metadata references wrong recipe")
            if record.get("status") != "generated_unpublished" or record.get("approved_for_publication") is not False:
                raise ValueError("Photo unexpectedly marked for publication")
            with Image.open(photo) as image:
                if image.format != "WEBP" or image.size != EXPECTED_SIZE:
                    raise ValueError(f"Unexpected image format or size: {image.format} {image.size}")
                image.verify()
            content = photo.read_bytes()
            digest = hashlib.sha256(content).hexdigest()
            if record.get("sha256") != digest or record.get("bytes") != len(content):
                raise ValueError("File hash/length does not match record")
            if digest in digests:
                problems.append(f"{ident}: image bytes duplicate {digests[digest]}")
            digests[digest] = ident
            completed.append(int(recipe["n"]))
        except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
            problems.append(f"{ident}: {type(error).__name__}: {error}")
    actual_photos = list((directory / "photos").glob("*.webp")) if (directory / "photos").exists() else []
    actual_records = list((directory / "records").glob("*.json")) if (directory / "records").exists() else []
    uncertainty = list((directory / "uncertain").glob("*.json")) if (directory / "uncertain").exists() else []
    raw_checkpoints = list((directory / "raw-checkpoint").glob("*")) if (directory / "raw-checkpoint").exists() else []
    return {
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total_recipes": len(recipes),
        "verified_webp": len(completed),
        "physical_webp_files": len(actual_photos),
        "metadata_records": len(actual_records),
        "missing_count": len(missing),
        "first_missing_recipe_number": missing[0] if missing else None,
        "uncertain_paid_requests": len(uncertainty),
        "unprocessed_raw_checkpoints": len(raw_checkpoints),
        "problem_count": len(problems),
        "problems": problems[:100],
        "complete_and_verified": len(completed) == len(recipes) and not problems and not uncertainty and not raw_checkpoints,
        "production_site_updated": False,
        "all_images_pending_visual_review": True,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=MANIFEST)
    parser.add_argument("--photo-base", type=Path, default=PHOTO_BASE)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    result = report_status(args.manifest, args.photo_base)
    print("PHOTO_LIBRARY_PROGRESS: " + json.dumps(result, ensure_ascii=False), flush=True)
    if args.write:
        target = args.photo_base / "progress.json"
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            old = json.loads(target.read_text(encoding="utf-8"))
            if {key: val for key, val in result.items() if key != "updated_at"} == {key: val for key, val in old.items() if key != "updated_at"}:
                result["updated_at"] = old.get("updated_at", result["updated_at"])
        temporary = target.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(target)
    # An interrupted response can leave a paid request of unknown billing status.
    # Keep its marker for explicit later recovery, but do not block unrelated recipes.
    # Raw checkpoints are also recoverable without paying again. True image/record
    # integrity errors must still halt production.
    if result["uncertain_paid_requests"] or result["unprocessed_raw_checkpoints"]:
        print("NOTICE: unresolved requests/checkpoints kept for later recovery; other recipes may proceed", flush=True)
    if result["problem_count"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
