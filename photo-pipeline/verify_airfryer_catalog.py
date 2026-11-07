#!/usr/bin/env python3
"""Cross-check all 100 air-fryer recipes, WebP files, photo records and visual QA statuses."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUTPUT = ROOT / "assets" / "airfryer"
LIBRARY = ROOT / "photo-library" / "airfryer"
PLAN = DATA / "airfryer-100-editorial-plan.json"
REVIEW = LIBRARY / "visual-review.json"


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-all-images", action="store_true")
    parser.add_argument("--sync-manifests", action="store_true")
    parser.add_argument("--sync-plan", action="store_true")
    parser.add_argument("--write-progress", action="store_true")
    args = parser.parse_args()

    manifests = sorted(DATA.glob("airfryer-recipes-batch-*.json"))
    problems: list[str] = []
    if len(manifests) != 10:
        problems.append(f"Expected 10 recipe batches, found {len(manifests)}")

    loaded = [(path, read_json(path)) for path in manifests]
    recipes = [recipe for _, data in loaded for recipe in data.get("recipes", [])]
    ids = [recipe.get("id") for recipe in recipes]
    if len(recipes) != 100:
        problems.append(f"Expected 100 recipes, found {len(recipes)}")
    if len(set(ids)) != len(ids):
        problems.append("Recipe IDs are not unique")

    if not REVIEW.is_file():
        problems.append("Missing photo-library/airfryer/visual-review.json")
        review_data = {"items": []}
    else:
        review_data = read_json(REVIEW)
    review_items = review_data.get("items", [])
    review_by_id = {item.get("id"): item for item in review_items if item.get("id")}
    if len(review_by_id) != 100:
        problems.append(f"Expected 100 unique visual review records, found {len(review_by_id)}")

    verified = missing = refused = uncertain = 0
    accepted = needs_regeneration = pending_recheck = 0
    for recipe in recipes:
        recipe_id = recipe["id"]
        image_path = OUTPUT / f"{recipe_id}.webp"
        record_path = LIBRARY / "records" / f"{recipe_id}.json"
        rejected_path = LIBRARY / "rejected" / f"{recipe_id}.json"
        pending_path = LIBRARY / "uncertain" / f"{recipe_id}.json"
        raw_path = LIBRARY / "raw-checkpoint" / f"{recipe_id}.png"
        review = review_by_id.get(recipe_id)
        review_status = review.get("status") if review else None

        if review_status == "visually_accepted":
            accepted += 1
        elif review_status == "needs_regeneration":
            needs_regeneration += 1
        elif review_status == "pending_recheck":
            pending_recheck += 1
        else:
            problems.append(f"{recipe_id}: missing or unknown visual review status")

        if image_path.exists() != record_path.exists():
            problems.append(f"{recipe_id}: partial image/record pair")
            continue
        if image_path.exists():
            try:
                record = read_json(record_path)
                with Image.open(image_path) as image:
                    image.load()
                    if image.format != "WEBP" or image.size != (1200, 900):
                        raise ValueError(f"unexpected image format/size: {image.format} {image.size}")
                digest = hashlib.sha256(image_path.read_bytes()).hexdigest()
                if digest != record.get("sha256"):
                    raise ValueError("SHA-256 mismatch")
                if record.get("recipe_id") != recipe_id:
                    raise ValueError("record recipe_id mismatch")
                if record.get("approved_for_publication") is not False:
                    raise ValueError("photo must remain unpublished")
                if recipe.get("publication_status") != "not_published":
                    raise ValueError("recipe publication status must remain not_published")
                if recipe.get("appliance_test_status") != "not_tested":
                    raise ValueError("physical appliance test must not be implied")
                verified += 1
                if args.sync_manifests:
                    recipe["photo_status"] = "generated_verified_unpublished"
                    recipe["photo_record_path"] = str(record_path.relative_to(ROOT))
                    recipe["photo_sha256"] = digest
                    recipe["visual_review_status"] = review_status
            except Exception as error:
                problems.append(f"{recipe_id}: {error}")
        elif rejected_path.exists():
            refused += 1
        elif pending_path.exists() or raw_path.exists():
            uncertain += 1
        else:
            missing += 1
            if args.require_all_images:
                problems.append(f"{recipe_id}: missing WebP or photo record")
            if args.sync_manifests:
                recipe["photo_status"] = "not_started"
                recipe.pop("photo_record_path", None)
                recipe.pop("photo_sha256", None)
                recipe["visual_review_status"] = review_status

    if args.sync_manifests:
        for path, data in loaded:
            write_json(path, data)

    if args.sync_plan and PLAN.is_file():
        plan = read_json(PLAN)
        status_by_id = {recipe["id"]: recipe for recipe in recipes}
        for item in plan.get("items", []):
            recipe = status_by_id.get(item.get("id"))
            if recipe:
                item["photo_status"] = recipe.get("photo_status")
                item["visual_review_status"] = recipe.get("visual_review_status")
                item["appliance_test_status"] = recipe.get("appliance_test_status", "not_tested")
                item["publication_status"] = recipe.get("publication_status", "not_published")
        plan["status"] = (
            "100 source-reviewed recipe drafts; photo integrity checked; visual review statuses tracked; "
            "not published and not physically tested on the owner's exact appliance."
        )
        write_json(PLAN, plan)

    progress = {
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total_recipes": len(recipes),
        "verified_webp": verified,
        "missing_count": missing,
        "refused_by_model_count": refused,
        "uncertain_paid_requests": uncertain,
        "problem_count": len(problems),
        "problems": problems,
        "complete_and_verified": verified == len(recipes) and missing == 0 and not refused and not uncertain and not problems,
        "visual_reviewed_count": accepted + needs_regeneration + pending_recheck,
        "visual_accepted_count": accepted,
        "needs_regeneration_count": needs_regeneration,
        "pending_recheck_count": pending_recheck,
        "publication_status": "all_generated_images_unpublished",
        "appliance_test_status": "not_tested_on_owner_exact_model",
    }
    if args.write_progress:
        write_json(LIBRARY / "progress.json", progress)

    print(json.dumps(progress, ensure_ascii=False, indent=2))
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
