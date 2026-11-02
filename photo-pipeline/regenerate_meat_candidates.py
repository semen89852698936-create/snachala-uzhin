#!/usr/bin/env python3
"""Single-attempt, source-pinned Yandex AI ART candidate regeneration for 14 meat recipes.

Only --perform invokes paid API. Reservations MUST be pushed to Git before --perform.
Do not run --perform interactively without a committed reservation.
No publication, originals remain untouched.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

import generate_yandexart as art

ROOT = art.ROOT
QUEUE_PATH = ROOT / "photo-library/meat-regeneration-queue-20261102.json"
OUT = ROOT / "photo-library/meat-regeneration-20261102"
EXPECTED = (21, 22, 23, 24, 26, 27, 28, 30, 31, 33, 34, 36, 41, 44)

def read_queue():
    queue = json.loads(QUEUE_PATH.read_text(encoding="utf-8"))
    items = queue["recipes"]
    ids = tuple(int(x["n"]) for x in items)
    if ids != EXPECTED or queue.get("count") != len(EXPECTED):
        raise RuntimeError("Queue is not the owner-approved exact list of 14 recipes")
    if queue.get("paid_generation_cap") != 14 or queue.get("auto_retry_paid_request") is not False:
        raise RuntimeError("Paid-call budget or no-retry policy was changed")
    if queue.get("publication_mode") != "candidate_only_never_auto_publish":
        raise RuntimeError("Cannot publish from regeneration worker")
    recipes = {int(x["n"]): x for x in art.load_recipes()}
    for item in items:
        n = int(item["n"])
        source = recipes[n]
        if source["id"] != item["id"] or source["title"] != item["title"] or source["category"] != "meat":
            raise RuntimeError(f"Recipe source mismatch for {n}")
        if item.get("status") != "queued" or item.get("approved_for_publication") is not False:
            raise RuntimeError(f"Unexpected editorial state for {n}")
        prompt = item.get("prompt_ru")
        if not isinstance(prompt, str) or not (90 <= len(prompt) <= art.MAX_PROMPT):
            raise RuntimeError(f"Invalid prompt length for {n}")
        expected_name = f'{n:04d}-{item["id"]}-regen.webp'
        if item["output_file"] != expected_name:
            raise RuntimeError(f"Wrong output file for {n}")
        original = ROOT / "photo-library/alice-ai-art/photos" / f'{n:04d}-{item["id"]}.webp'
        if not original.is_file():
            raise RuntimeError(f"Missing untouched original for {n}: {original}")
    return {int(item["n"]): item for item in items}

def paths(item):
    stem = Path(item["output_file"]).stem
    return (OUT / "photos" / (stem + ".webp"),
            OUT / "records" / (stem + ".json"),
            OUT / "reservations" / (stem + ".json"),
            OUT / "raw-checkpoint" / (stem + ".png"))

def write_json(path, payload):
    art.atomic_write(path, (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))

def reserve(item):
    photo, record, reservation, raw = paths(item)
    if any(p.exists() for p in (photo, record, reservation, raw)):
        print(f"SKIP_ALREADY_ATTEMPTED {item['n']}", flush=True)
        return 0
    write_json(reservation, {
        "n": item["n"], "recipe_id": item["id"],
        "prompt_sha256": hashlib.sha256(item["prompt_ru"].encode()).hexdigest(),
        "status": "reserved_before_paid_call",
        "attempt_number": 1,
        "reserved_at": art.utc_now(),
        "no_auto_retry": True,
        "publication_approved": False,
    })
    print(f"RESERVED {item['n']}", flush=True)
    return 0

def perform(item):
    photo, record, reservation, raw = paths(item)
    if not reservation.is_file():
        raise RuntimeError("Missing Git-pushed reservation before paid request")
    marker = json.loads(reservation.read_text(encoding="utf-8"))
    if marker.get("status") != "reserved_before_paid_call" or marker.get("attempt_number") != 1:
        raise RuntimeError(f"Refusing to retry already attempted request #{item['n']}")
    if marker.get("prompt_sha256") != hashlib.sha256(item["prompt_ru"].encode()).hexdigest():
        raise RuntimeError("Reservation prompt changed")
    if any(p.exists() for p in (photo, record, raw)):
        raise RuntimeError("Conflicting result already exists. Manual recovery only")
    if os.getenv("PHOTO_COST_APPROVED") != "true":
        raise RuntimeError("Owner's paid generation flag is absent")
    key, folder = os.getenv("YANDEX_API_KEY"), os.getenv("YANDEX_FOLDER_ID")
    if not key or not folder:
        raise RuntimeError("Yandex credentials missing: no API call performed")
    try:
        data = art.request_image(item["prompt_ru"], key, folder)
    except art.ModelImageRefusal as exc:
        marker["status"] = "refused_no_image_no_retry"
        marker["finished_at"] = art.utc_now()
        marker["reason"] = str(exc)[:400]
        write_json(reservation, marker)
        print(f"MODEL_REFUSED {item['n']}", flush=True)
        return 0
    except Exception as exc:
        marker["status"] = "uncertain_paid_result_no_retry"
        marker["finished_at"] = art.utc_now()
        marker["error_type"] = type(exc).__name__
        write_json(reservation, marker)
        raise
    # Save paid raw response first in case conversion fails. Never issue a retry.
    art.atomic_write(raw, data)
    image = art.encode_webp(data)
    art.atomic_write(photo, image)
    write_json(record, {
        "n": item["n"], "recipe_id": item["id"], "title": item["title"],
        "prompt": item["prompt_ru"], "original_live_path": item["existing_live_path"],
        "original_git_blob_sha": item["original_blob_sha"],
        "path": str(photo.relative_to(ROOT)),
        "sha256": hashlib.sha256(image).hexdigest(),
        "bytes": len(image), "size": list(art.TARGET_SIZE),
        "model": art.MODEL, "created_at": art.utc_now(),
        "status": "generated_candidate_unpublished",
        "approved_for_publication": False,
        "site_updated": False,
    })
    marker["status"] = "generated_candidate_unpublished"
    marker["finished_at"] = art.utc_now()
    write_json(reservation, marker)
    raw.unlink(missing_ok=True)
    print(f"GENERATED_CANDIDATE {item['n']} {photo.name} bytes={len(image)}", flush=True)
    return 0

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--check", action="store_true")
    action.add_argument("--reserve", type=int)
    action.add_argument("--perform", type=int)
    args = parser.parse_args()
    queue = read_queue()
    if args.check:
        print(f"QUEUE_OK {len(queue)} existing meat recipes; exact source IDs and prompts checked; no API")
        return
    n = args.reserve if args.reserve is not None else args.perform
    if n not in queue:
        parser.error(f"Recipe {n} is not allowed")
    if args.reserve is not None:
        reserve(queue[n])
    else:
        perform(queue[n])

if __name__ == "__main__":
    main()
