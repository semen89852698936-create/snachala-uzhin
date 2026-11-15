#!/usr/bin/env python3
"""Prepare or generate ten ORIGINAL Alice AI ART photographs for the plov collection.

Default mode is a safe/free dry run. A paid API call needs --execute,
PHOTO_COST_APPROVED=true, YANDEX_API_KEY and YANDEX_FOLDER_ID.
Never reattempt an uncertain paid request automatically.
Reference screenshots in ПЛОВ.docx are visual *guidance*, not publishable images.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/plov-ten-editorial.json"
OUTPUT = ROOT / "assets/plov"
AUDIT = ROOT / "photo-library/plov"
CORE_PATH = ROOT / "photo-pipeline/generate_airfryer_batch.py"

spec = importlib.util.spec_from_file_location("airfryer_photo_core", CORE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Could not load shared Alice AI ART photo generator")
core = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = core
spec.loader.exec_module(core)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--end", type=int, default=10)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--reserve-only", action="store_true", help="Write a durable no-cost reservation before requesting any image")
    args = parser.parse_args()
    if not 1 <= args.start <= args.end <= 10 or not 1 <= args.limit <= 10:
        parser.error("Expected start/end and limit within 1..10")
    if args.execute and args.reserve_only:
        parser.error("--execute and --reserve-only cannot be combined")
    if args.execute and (
        os.getenv("PHOTO_COST_APPROVED") != "true"
        or not os.getenv("YANDEX_API_KEY")
        or not os.getenv("YANDEX_FOLDER_ID")
    ):
        parser.error("Paid generation needs PHOTO_COST_APPROVED=true and Yandex API credentials")

    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    recipes = data["recipes"]
    if data["recipe_count"] != 10 or len(recipes) != 10:
        raise ValueError("Plov collection must contain exactly ten recipes")
    ids = [r["id"] for r in recipes]
    if len(set(ids)) != 10 or any(not r["photo_brief"] for r in recipes):
        raise ValueError("Missing unique IDs or photo briefs")
    generated = skipped = 0
    for number, recipe in enumerate(recipes, 1):
        if not args.start <= number <= args.end:
            continue
        rid = recipe["id"]
        expected = "/assets/plov/" + rid + ".webp"
        if recipe["photo"] != expected:
            raise ValueError(f"Unexpected photo path for {rid}")

        out = OUTPUT / (rid + ".webp")
        record = AUDIT / "records" / (rid + ".json")
        uncertain = AUDIT / "uncertain" / (rid + ".json")
        raw_path = AUDIT / "raw-checkpoint" / (rid + ".png")

        prompt = core.make_prompt(recipe)
        if out.exists():
            if record.exists():
                core.verify_existing(out, record)
            else:
                from PIL import Image
                with Image.open(out) as image:
                    image.verify()
            print(json.dumps({"number": number, "id": rid, "skipped": "already_exists"}, ensure_ascii=False))
            skipped += 1
            continue

        if args.reserve_only:
            if uncertain.exists():
                raise RuntimeError(f"Unresolved earlier reservation for {rid}; manual review required")
            core.atomic_write(uncertain, json.dumps({
                "id": rid, "status": "prepared_not_sent", "created_at": core.utc_now(),
                "prompt": prompt, "never_retry_automatically": True,
            }, ensure_ascii=False, indent=2).encode("utf-8"))
            print(json.dumps({"number": number, "id": rid, "reserved": True}, ensure_ascii=False))
            generated += 1
            if generated >= args.limit:
                break
            continue

        if not args.execute:
            print(json.dumps({
                "number": number, "id": rid, "photo_reference_page": recipe["source_photo_page"],
                "prompt": prompt, "would_generate": True,
            }, ensure_ascii=False))
            generated += 1
            if generated >= args.limit:
                break
            continue

        if uncertain.exists() and not raw_path.exists():
            record_state = json.loads(uncertain.read_text(encoding="utf-8")).get("status")
            if record_state != "prepared_not_sent":
                raise RuntimeError(f"Uncertain paid generation for {rid}; manual recovery required")
        if raw_path.exists():
            raw = raw_path.read_bytes()
        else:
            core.atomic_write(uncertain, json.dumps({
                "id": rid, "status": "request_pending_or_sent",
                "prompt": prompt, "created_at": core.utc_now(),
                "no_automatic_retry": True,
            }, ensure_ascii=False, indent=2).encode("utf-8"))
            raw = core.request_image(prompt, os.environ["YANDEX_API_KEY"], os.environ["YANDEX_FOLDER_ID"])
            core.atomic_write(raw_path, raw)

        webp = core.encode_webp(raw)
        core.atomic_write(out, webp)
        digest = hashlib.sha256(webp).hexdigest()
        core.atomic_write(record, json.dumps({
            "id": rid, "file": str(out.relative_to(ROOT)), "sha256": digest,
            "generator": "aliceai-image-art-3.0", "prompt": prompt,
            "reference": f"ПЛОВ.docx, photo {number}, page {recipe['source_photo_page']}",
            "visual_review_status": "pending_owner_visual_review",
            "generated_at": core.utc_now(),
        }, ensure_ascii=False, indent=2).encode("utf-8"))
        uncertain.unlink(missing_ok=True)
        generated += 1
        print(json.dumps({"id": rid, "saved": str(out.relative_to(ROOT)), "sha256": digest}, ensure_ascii=False))
        if generated >= args.limit:
            break
    print(json.dumps({"generated_or_planned": generated, "skipped": skipped, "execute": args.execute}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
