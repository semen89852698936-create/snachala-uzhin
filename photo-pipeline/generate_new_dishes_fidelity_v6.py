#!/usr/bin/env python3
"""Create one corrected Alice AI ART photos from precise supplied source visual descriptions.

--reserve-only persists an unsent reservation.
--mark-intent persists an attempt marker BEFORE any potentially paid call.
--execute refuses uncertain attempts; there are no automatic retries.
Photos are staged in an unpublished review-v6 directory. Original images remain untouched.
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
MANIFEST = ROOT / "data/new-dishes-photo-fidelity-v6.json"
OUTPUT = ROOT / "assets/new-dishes/review-v6"
AUDIT = ROOT / "photo-library/new-dishes/review-v6"
CORE_PATH = ROOT / "photo-pipeline/generate_airfryer_batch.py"

spec = importlib.util.spec_from_file_location("alice_photo_core", CORE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Cannot load Alice AI ART core")
core = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = core
spec.loader.exec_module(core)


def image_prompt(recipe: dict) -> str:
    prompt = (
        "Фотореалистичная фотография еды: "
        + str(recipe.get("prompt_title") or recipe["title"]) + ". "
        + str(recipe["photo_brief"])
        + " Без текста."
    )
    if len(prompt) > 500:
        raise ValueError(f"Prompt exceeds 500 characters ({len(prompt)}): {recipe['id']}")
    return prompt


def load_recipes() -> list[dict]:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if len(data["recipes"]) != 1 or len(set(r["id"] for r in data["recipes"])) != 1:
        raise ValueError("Expected exactly one unique photo revisions")
    for r in data["recipes"]:
        if not r["id"].startswith("nd-") or r["photo"] != f"/assets/new-dishes/review-v6/{r['id']}.webp":
            raise ValueError(f"Invalid photo identity: {r['id']}")
        image_prompt(r)
    return data["recipes"]


def save_json(path: Path, obj: dict) -> None:
    core.atomic_write(path, (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--number", type=int, required=True, help="One-based photo number, 1..1")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--reserve-only", action="store_true")
    mode.add_argument("--mark-intent", action="store_true")
    mode.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    recipes = load_recipes()
    if not 1 <= args.number <= 1:
        parser.error("number must be 1..1")
    r = recipes[args.number - 1]
    rid = r["id"]
    prompt = image_prompt(r)
    output = OUTPUT / f"{rid}.webp"
    record = AUDIT / "records" / f"{rid}.json"
    pending = AUDIT / "reservations" / f"{rid}.json"
    raw = AUDIT / "raw-checkpoint" / f"{rid}.png"
    rejected = AUDIT / "rejected" / f"{rid}.json"

    if output.exists():
        core.verify_existing(output, record)
        print(json.dumps({"id": rid, "already_generated": True}, ensure_ascii=False))
        return 0
    if record.exists() or rejected.exists():
        raise RuntimeError("Existing incomplete or rejected attempt needs manual review")
    if not (args.reserve_only or args.mark_intent or args.execute):
        print(json.dumps({"id": rid, "source_photo_page": r["source_photo_page"],
                          "prompt": prompt, "would_generate": True}, ensure_ascii=False))
        return 0

    if args.reserve_only:
        if pending.exists():
            raise RuntimeError("Existing reservation: never overwrite or repeat automatically")
        save_json(pending, {"id": rid, "status": "prepared_not_sent",
                            "created_at": core.utc_now(), "prompt": prompt,
                            "no_automatic_retry": True})
        print(f"RESERVED: {rid}")
        return 0

    if not pending.exists():
        raise RuntimeError("Must reserve this photo before any image request")
    state = json.loads(pending.read_text(encoding="utf-8"))

    if args.mark_intent:
        if state.get("status") != "prepared_not_sent":
            raise RuntimeError("Attempt already marked, do not repeat")
        state["status"] = "request_pending_or_sent"
        state["marked_at"] = core.utc_now()
        save_json(pending, state)
        print(f"INTENT_MARKED: {rid}")
        return 0

    if state.get("status") != "request_pending_or_sent":
        raise RuntimeError("Cannot execute without persisted request intent")
    if os.getenv("PHOTO_COST_APPROVED") != "true":
        raise RuntimeError("Paid photo generation is not authorized")
    if not (os.getenv("YANDEX_API_KEY") and os.getenv("YANDEX_FOLDER_ID")):
        raise RuntimeError("Missing Alice AI ART API credentials")

    # A single paid call, no retries. If interrupted, the persisted intent blocks reruns.
    if not raw.exists():
        image_data = core.request_image(prompt, os.environ["YANDEX_API_KEY"], os.environ["YANDEX_FOLDER_ID"])
        core.atomic_write(raw, image_data)
    else:
        image_data = raw.read_bytes()
    webp = core.encode_webp(image_data)
    core.atomic_write(output, webp)
    save_json(record, {"id": rid, "photo": str(output.relative_to(ROOT)),
                       "sha256": hashlib.sha256(webp).hexdigest(), "generator": core.MODEL,
                       "prompt": prompt, "source_photo_page": r["source_photo_page"],
                       "source_document": "Новые блюда.docx",
                       "status": "generated_pending_owner_visual_review",
                       "created_at": core.utc_now()})
    pending.unlink(missing_ok=True)
    print(json.dumps({"id": rid, "generated": True, "bytes": len(webp)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
