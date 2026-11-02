#!/usr/bin/env python3
"""One-attempt, checkpoint-first recovery for missing recipe photos.

Prepare reserves exactly one missing photo and must be git-pushed BEFORE perform
is invoked. A reservation is NEVER prepared a second time. An interrupted
perform must be investigated separately rather than re-charged automatically.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

import generate_yandexart as worker

ROOT = worker.ROOT
BASE = worker.DEST


def retry_food_prompt(recipe):
    """Disambiguate pomegranate *fruit* in harmless salad photography."""
    title = worker.clean(recipe["title"]).replace(
        "гранатом", "сочными рубиновыми зёрнышками сладкого фрукта"
    )
    ingredients = [
        "Сочные рубиновые красные фруктовые зёрнышки"
        if "гранат" in worker.clean(i).casefold()
        else worker.clean(i)
        for i in recipe.get("ingredients", [])
    ]
    ingredients = [x for x in ingredients if x][:10]
    return (
        f"Реалистичная фотография готового блюда для премиальной кулинарной книги: {title}. "
        f"В тарелке отчётливо видны: {', '.join(ingredients)}. "
        "Свежий аппетитный салат, красивая аккуратная подача на светлой керамике, "
        "мягкий тёплый свет, естественная фуд-фотография. "
        "Без текста, надписей, людей и коллажей."
    )[:worker.MAX_PROMPT]


def reservation_file(kind, recipe, output):
    return Path(output) / ("rejected" if kind == "refused" else "uncertain") / (
        f'{int(recipe["n"]):04d}-{recipe["id"]}.json'
    )


def dest_files(recipe, output):
    stem = f'{int(recipe["n"]):04d}-{recipe["id"]}'
    return (
        Path(output) / "photos" / (stem + ".webp"),
        Path(output) / "records" / (stem + ".json"),
        Path(output) / "raw-checkpoint" / (stem + ".png"),
    )


def prepare(kind, marker_output, output=BASE):
    for r in worker.load_recipes():
        marker_path = reservation_file(kind, r, output)
        photo, record, _ = dest_files(r, output)
        if photo.exists() or record.exists() or not marker_path.exists():
            continue
        data = json.loads(marker_path.read_text(encoding="utf-8"))
        if data.get("recovery_attempt_reserved_at"):
            # Even if the previous process died, never try a second time.
            continue
        if kind == "refused" and data.get("status") != "refused_by_model":
            continue
        if kind == "uncertain" and data.get("status") != "request_pending_or_sent":
            continue
        if kind == "uncertain":
            # First request may have been billed; flag this explicitly.
            recovery_prompt = worker.prompt(r)
            data["recovery_possible_duplicate_charge"] = True
            data["recovery_reason"] = "Previous Yandex response truncated after 373217 bytes; no image checkpoint exists."
        else:
            recovery_prompt = retry_food_prompt(r)
            data["recovery_possible_duplicate_charge"] = False
            data["recovery_reason"] = "Original salad prompt refused by model, retry with fruit-only wording."
        data["recovery_attempt_reserved_at"] = worker.utc_now()
        data["recovery_prompt"] = recovery_prompt
        data["recovery_one_attempt_only"] = True
        worker.atomic_write(marker_path, (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode())
        Path(marker_output).write_text(str(r["n"]), encoding="ascii")
        print(f"RECOVERY_RESERVED kind={kind} n={r['n']}", flush=True)
        return int(r["n"])
    Path(marker_output).write_text("NONE", encoding="ascii")
    print(f"NO_RECOVERY_CANDIDATES kind={kind}", flush=True)
    return None


def perform(kind, marker_output, output=BASE):
    chosen = Path(marker_output).read_text(encoding="ascii").strip()
    if chosen == "NONE":
        print("NO_RECOVERY_CANDIDATES")
        return
    recipes = {int(r["n"]): r for r in worker.load_recipes()}
    r = recipes[int(chosen)]
    photo, record, raw_path = dest_files(r, output)
    marker_path = reservation_file(kind, r, output)
    if photo.exists() and record.exists():
        print(f"ALREADY_RECOVERED {chosen}")
        return
    data = json.loads(marker_path.read_text(encoding="utf-8"))
    if not data.get("recovery_attempt_reserved_at") or not data.get("recovery_one_attempt_only"):
        raise RuntimeError("Paid recovery must be reserved and committed in Git before execution")
    if raw_path.exists():
        raw = raw_path.read_bytes()
        print(f"RECOVER_RAW_CHECKPOINT n={chosen}")
    else:
        try:
            raw = worker.request_image(
                data["recovery_prompt"], os.environ["YANDEX_API_KEY"], os.environ["YANDEX_FOLDER_ID"]
            )
        except worker.ModelImageRefusal as err:
            data["recovery_result"] = "refused_again"
            data["recovery_finished_at"] = worker.utc_now()
            data["recovery_error"] = str(err)
            worker.atomic_write(marker_path, (json.dumps(data, ensure_ascii=False, indent=2)+"\n").encode())
            print(f"RECOVERY_REFUSED_AGAIN n={chosen}", flush=True)
            return
        except Exception:
            # Already reserved in Git before request. Never automatically retry.
            data["recovery_result"] = "uncertain_request_result_no_auto_retry"
            worker.atomic_write(marker_path, (json.dumps(data, ensure_ascii=False, indent=2)+"\n").encode())
            raise
        worker.atomic_write(raw_path, raw)
    webp = worker.encode_webp(raw)
    worker.atomic_write(photo, webp)
    metadata = {
        "n": int(r["n"]), "recipe_id": r["id"], "title": r["title"],
        "ingredients": r.get("ingredients", []), "prompt": data["recovery_prompt"],
        "path": str(photo.relative_to(ROOT)) if photo.is_relative_to(ROOT) else str(photo),
        "sha256": hashlib.sha256(webp).hexdigest(), "bytes": len(webp),
        "size": list(worker.TARGET_SIZE), "model": worker.MODEL,
        "generated_at": worker.utc_now(), "status": "generated_unpublished",
        "approved_for_publication": False, "recovered_after": kind,
        "previous_request_may_have_been_billed": bool(data.get("recovery_possible_duplicate_charge")),
    }
    worker.atomic_write(record, (json.dumps(metadata, ensure_ascii=False, indent=2)+"\n").encode())
    marker_path.unlink(missing_ok=True)
    raw_path.unlink(missing_ok=True)
    print(f"RECOVERED_IMAGE n={chosen} bytes={len(webp)}", flush=True)


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kind", choices=("refused", "uncertain"), required=True)
    actions=parser.add_mutually_exclusive_group(required=True)
    actions.add_argument("--prepare", action="store_true")
    actions.add_argument("--perform", action="store_true")
    parser.add_argument("--reservation", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=BASE)
    args=parser.parse_args(argv)
    if args.perform and (os.getenv("PHOTO_COST_APPROVED")!="true" or not os.getenv("YANDEX_API_KEY") or not os.getenv("YANDEX_FOLDER_ID")):
        parser.error("Paid recovery requires PHOTO_COST_APPROVED and Yandex secrets")
    if args.prepare:
        prepare(args.kind,args.reservation,args.output)
    else:
        perform(args.kind,args.reservation,args.output)


if __name__=="__main__":
    main()
