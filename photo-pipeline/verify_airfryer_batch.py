#!/usr/bin/env python3
"""Verify generated unpublished air-fryer WebP files and write progress."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "airfryer-recipes-batch-01.json"
OUTPUT = ROOT / "assets" / "airfryer"
LIBRARY = ROOT / "photo-library" / "airfryer"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', type=Path, default=MANIFEST)
    parser.add_argument('--progress-file', default='progress.json')
    args = parser.parse_args()
    data = json.loads(args.manifest.read_text(encoding="utf-8"))
    recipes = data["recipes"]
    verified = refused = uncertain = missing = 0
    problems = []
    for recipe in recipes:
        recipe_id = recipe["id"]
        image_path = OUTPUT / f"{recipe_id}.webp"
        record_path = LIBRARY / "records" / f"{recipe_id}.json"
        rejected_path = LIBRARY / "rejected" / f"{recipe_id}.json"
        pending_path = LIBRARY / "uncertain" / f"{recipe_id}.json"
        raw_path = LIBRARY / "raw-checkpoint" / f"{recipe_id}.png"
        if image_path.exists() != record_path.exists():
            problems.append(f"partial image/record pair: {recipe_id}")
            continue
        if image_path.exists():
            try:
                record = json.loads(record_path.read_text(encoding="utf-8"))
                with Image.open(image_path) as image:
                    image.load()
                    if image.format != "WEBP" or image.size != (1200, 900):
                        raise ValueError(f"unexpected image format/size: {image.format} {image.size}")
                digest = hashlib.sha256(image_path.read_bytes()).hexdigest()
                if digest != record.get("sha256"):
                    raise ValueError("SHA-256 mismatch")
                if record.get("approved_for_publication") is not False:
                    raise ValueError("photo must remain unpublished")
                verified += 1
            except Exception as error:
                problems.append(f"{recipe_id}: {error}")
        elif rejected_path.exists():
            refused += 1
        elif pending_path.exists() or raw_path.exists():
            uncertain += 1
        else:
            missing += 1
    progress = {
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total_recipes": len(recipes),
        "verified_webp": verified,
        "missing_count": missing,
        "refused_by_model_count": refused,
        "uncertain_paid_requests": uncertain,
        "problem_count": len(problems),
        "problems": problems,
        "complete_and_verified": verified == len(recipes) and not refused and not uncertain and not problems,
        "publication_status": "all_generated_images_unpublished",
    }
    LIBRARY.mkdir(parents=True, exist_ok=True)
    (LIBRARY / args.progress_file).write_text(
        json.dumps(progress, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(progress, ensure_ascii=False, indent=2))
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
