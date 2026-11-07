#!/usr/bin/env python3
"""Generate one unpublished Yandex AI ART WebP per air-fryer recipe.

Dry-run is free. Paid calls require --execute, YANDEX_API_KEY,
YANDEX_FOLDER_ID and PHOTO_COST_APPROVED=true. Every successful paid response
is checkpointed before decoding; uncertain requests are never retried.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "airfryer-recipes-batch-01.json"
OUTPUT = ROOT / "assets" / "airfryer"
LIBRARY = ROOT / "photo-library" / "airfryer"
MODEL = "aliceai-image-art-3.0"
API_URL = "https://ai.api.cloud.yandex.net/v1/images/generations"
TARGET_SIZE = (1200, 900)
MAX_PROMPT = 500


class ModelImageRefusal(RuntimeError):
    """Yandex explicitly rejected a prompt; no image was returned."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def load_manifest(manifest_path: Path = MANIFEST) -> list[dict]:
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    recipes = data.get("recipes", [])
    if data.get("recipe_count") != 10 or len(recipes) != 10:
        raise RuntimeError("Expected exactly 10 air-fryer poultry recipes")
    ids = [r.get("id") for r in recipes]
    if len(set(ids)) != 10 or any(not x for x in ids):
        raise RuntimeError("Recipe IDs must be present and unique")
    for recipe in recipes:
        if recipe.get("photo_status") not in {"not_started", "generated_verified_unpublished"}:
            raise RuntimeError(f"Unexpected photo status for {recipe['id']}")
        if recipe.get("visual_review_status") not in {None, "visually_accepted", "needs_regeneration", "pending_recheck"}:
            raise RuntimeError(f"Unexpected visual review status for {recipe['id']}")
        if recipe.get("publication_status") != "not_published":
            raise RuntimeError(f"Refusing to process published recipe {recipe['id']}")
        if not recipe.get("photo_brief"):
            raise RuntimeError(f"Missing photo brief for {recipe['id']}")
    return recipes


def make_prompt(recipe: dict) -> str:
    title = clean(recipe["title"])
    brief = clean(recipe["photo_brief"])
    ingredients = []
    for item in recipe.get("ingredients", [])[:2]:
        if isinstance(item, (list, tuple)) and len(item) >= 1:
            ingredients.append(clean(item[0]))
    ingredient_text = ", ".join(ingredients)
    prefix = "Фотореалистичная ресторанная фотография готового блюда. "
    title_part = f"Блюдо: {title}. "
    ingredient_part = f"Главное: {ingredient_text}. " if ingredient_text else ""
    suffix = "Один кадр, без коллажей, текста, людей и логотипов. Подача на двоих, мягкий тёплый свет."
    fixed = prefix + title_part + ingredient_part + "Детали: ." + suffix
    brief_limit = max(0, MAX_PROMPT - len(fixed) - 2)
    brief = brief[:brief_limit].rstrip(" ,.;")
    prompt = prefix + title_part + ingredient_part + f"Детали: {brief}. " + suffix
    if len(prompt) > MAX_PROMPT:
        prompt = prefix + title_part + f"Детали: {brief}. " + suffix
    if len(prompt) > MAX_PROMPT:
        raise RuntimeError(f"Could not fit a safe prompt for {recipe['id']} within {MAX_PROMPT} characters")
    return prompt

def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(content)
    tmp.replace(path)


def request_image(prompt_text: str, key: str, folder: str) -> bytes:
    payload = json.dumps({
        "model": f"art://{folder}/{MODEL}",
        "prompt": prompt_text,
        "size": "1536x1024",
        "n": 1,
    }, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Api-Key {key}",
            "OpenAI-Project": folder,
            "User-Agent": "SnachalaUzhinAirfryerPhotoGenerator/1.0",
        },
    )
    # Intentionally no automatic retry: one paid attempt per recipe.
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read(1600).decode("utf-8", errors="replace")
        try:
            message = json.loads(detail).get("error", {}).get("message", "")
        except (ValueError, AttributeError, TypeError):
            message = detail
        if error.code == 400 and "Я не могу сгенерировать это изображение" in str(message):
            raise ModelImageRefusal(f"Yandex refused prompt: {message}") from error
        raise RuntimeError(f"Yandex API HTTP {error.code}: {detail}") from error
    encoded = result["data"][0].get("b64_json")
    if not encoded:
        raise RuntimeError("Yandex API did not return b64_json")
    return base64.b64decode(encoded, validate=True)


def encode_webp(image_data: bytes) -> bytes:
    with Image.open(io.BytesIO(image_data)) as image:
        image.load()
        if image.width < 900 or image.height < 700:
            raise RuntimeError(f"Generated image too small: {image.size}")
        image = ImageOps.exif_transpose(image).convert("RGB")
        image = ImageOps.fit(image, TARGET_SIZE, method=Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, "WEBP", quality=88, method=6)
        return output.getvalue()


def verify_existing(image_path: Path, record_path: Path) -> None:
    if not image_path.is_file() or not record_path.is_file():
        raise RuntimeError(f"Partial output needs manual recovery: {image_path.name}")
    record = json.loads(record_path.read_text(encoding="utf-8"))
    with Image.open(image_path) as image:
        image.verify()
    actual = hashlib.sha256(image_path.read_bytes()).hexdigest()
    if actual != record.get("sha256"):
        raise RuntimeError(f"Existing WebP SHA-256 mismatch: {image_path.name}")


def archive_visual_rejection(recipe: dict, image_path: Path, record_path: Path) -> None:
    if image_path.exists() != record_path.exists():
        raise RuntimeError(f"Partial rejected image/record pair needs manual recovery: {recipe['id']}")
    if not image_path.exists():
        return
    record = json.loads(record_path.read_text(encoding="utf-8"))
    digest = record.get("sha256") or hashlib.sha256(image_path.read_bytes()).hexdigest()
    archive_root = LIBRARY / "rejected-visual"
    archive_root.mkdir(parents=True, exist_ok=True)
    stem = f"{recipe['id']}-{digest[:12]}"
    atomic_write(archive_root / f"{stem}.webp", image_path.read_bytes())
    archived_record = dict(record)
    archived_record.update({
        "visual_review_status": "needs_regeneration",
        "visual_rejection_note": recipe.get("visual_review_note", ""),
        "archived_at": utc_now(),
        "archived_image_path": str((archive_root / f"{stem}.webp").relative_to(ROOT)),
    })
    atomic_write(archive_root / f"{stem}.json", json.dumps(archived_record, ensure_ascii=False, indent=2).encode("utf-8"))
    image_path.unlink()
    record_path.unlink()


def mark_replacement_pending(manifest_path: Path, recipe_id: str, digest: str, record_path: Path) -> None:
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    for recipe in data.get("recipes", []):
        if recipe.get("id") == recipe_id:
            recipe["photo_status"] = "generated_verified_unpublished"
            recipe["visual_review_status"] = "pending_recheck"
            recipe["photo_record_path"] = str(record_path.relative_to(ROOT))
            recipe["photo_sha256"] = digest
            break
    atomic_write(manifest_path, (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))

    review_path = LIBRARY / "visual-review.json"
    if not review_path.exists():
        return
    review = json.loads(review_path.read_text(encoding="utf-8"))
    for item in review.get("items", []):
        if item.get("id") == recipe_id:
            item["status"] = "pending_recheck"
            item["replacement_generated_at"] = utc_now()
            item["replacement_sha256"] = digest
            break
    review["visually_accepted"] = sum(x.get("status") == "visually_accepted" for x in review.get("items", []))
    review["needs_regeneration"] = sum(x.get("status") == "needs_regeneration" for x in review.get("items", []))
    review["pending_recheck"] = sum(x.get("status") == "pending_recheck" for x in review.get("items", []))
    atomic_write(review_path, (json.dumps(review, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=MANIFEST)
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--end", type=int, default=100)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args(argv)
    if not (1 <= args.start <= args.end <= 100):
        parser.error("start/end must be between 1 and 100")
    if not (1 <= args.limit <= 10):
        parser.error("limit must be 1..10")
    if args.execute:
        if os.getenv("PHOTO_COST_APPROVED") != "true":
            parser.error("Set PHOTO_COST_APPROVED=true to permit paid API calls")
        if not os.getenv("YANDEX_API_KEY") or not os.getenv("YANDEX_FOLDER_ID"):
            parser.error("Set YANDEX_API_KEY and YANDEX_FOLDER_ID via GitHub Secrets")

    recipes = [r for r in load_manifest(args.manifest) if args.start <= int(r["number"]) <= args.end]
    made = skipped = refused = 0
    for recipe in recipes:
        recipe_id = recipe["id"]
        image_path = OUTPUT / f"{recipe_id}.webp"
        record_path = LIBRARY / "records" / f"{recipe_id}.json"
        pending_path = LIBRARY / "uncertain" / f"{recipe_id}.json"
        rejected_path = LIBRARY / "rejected" / f"{recipe_id}.json"
        raw_path = LIBRARY / "raw-checkpoint" / f"{recipe_id}.png"

        needs_regeneration = recipe.get("visual_review_status") == "needs_regeneration"
        prompt_text = make_prompt(recipe)
        if needs_regeneration:
            if not args.execute:
                print(json.dumps({
                    "id": recipe_id, "title": recipe["title"],
                    "prompt": prompt_text, "would_regenerate": True,
                }, ensure_ascii=False))
                made += 1
                if made >= args.limit:
                    break
                continue
            archive_visual_rejection(recipe, image_path, record_path)
        elif image_path.exists() or record_path.exists():
            verify_existing(image_path, record_path)
            skipped += 1
            continue
        elif recipe.get("photo_status") == "generated_verified_unpublished":
            raise RuntimeError(f"Verified photo is missing for {recipe_id}; refusing an automatic paid duplicate.")
        if rejected_path.exists():
            refused += 1
            continue

        if not args.execute:
            print(json.dumps({
                "id": recipe_id, "title": recipe["title"],
                "prompt": prompt_text, "would_generate": True,
            }, ensure_ascii=False))
            made += 1
            if made >= args.limit:
                break
            continue

        if pending_path.exists() and not raw_path.exists():
            raise RuntimeError(
                f"Uncertain paid request exists for {recipe_id}; refusing duplicate generation"
            )
        if raw_path.exists():
            raw = raw_path.read_bytes()  # recover a paid response without another request
            print(f"RECOVER_RAW {recipe_id}", flush=True)
        else:
            atomic_write(pending_path, json.dumps({
                "recipe_id": recipe_id,
                "title": recipe["title"],
                "status": "request_pending_or_sent",
                "created_at": utc_now(),
                "note": "If no raw checkpoint exists after interruption, do not retry automatically.",
            }, ensure_ascii=False, indent=2).encode("utf-8"))
            try:
                raw = request_image(
                    prompt_text,
                    os.environ["YANDEX_API_KEY"],
                    os.environ["YANDEX_FOLDER_ID"],
                )
            except ModelImageRefusal as error:
                atomic_write(rejected_path, json.dumps({
                    "recipe_id": recipe_id,
                    "title": recipe["title"],
                    "prompt": prompt_text,
                    "status": "refused_by_model",
                    "reason": str(error),
                    "created_at": utc_now(),
                    "owner_review_required": True,
                }, ensure_ascii=False, indent=2).encode("utf-8"))
                pending_path.unlink(missing_ok=True)
                refused += 1
                print(f"MODEL_REFUSAL_ARCHIVED {recipe_id}", flush=True)
                continue
            # Preserve the paid response before decoding or cropping.
            atomic_write(raw_path, raw)

        webp = encode_webp(raw)
        digest = hashlib.sha256(webp).hexdigest()
        atomic_write(image_path, webp)
        record = {
            "recipe_id": recipe_id,
            "recipe_number": recipe["number"],
            "title": recipe["title"],
            "ingredients": recipe.get("ingredients", []),
            "prompt": prompt_text,
            "path": str(image_path.relative_to(ROOT)),
            "sha256": digest,
            "bytes": len(webp),
            "size": list(TARGET_SIZE),
            "model": MODEL,
            "generated_at": utc_now(),
            "status": "generated_unpublished",
            "approved_for_publication": False,
        }
        atomic_write(record_path, json.dumps(record, ensure_ascii=False, indent=2).encode("utf-8"))
        pending_path.unlink(missing_ok=True)
        raw_path.unlink(missing_ok=True)
        mark_replacement_pending(args.manifest, recipe_id, digest, record_path)
        made += 1
        print(f"GENERATED {recipe_id} sha256={digest} bytes={len(webp)}", flush=True)
        if made >= args.limit:
            break

    print(json.dumps({
        "mode": "execute" if args.execute else "dry-run",
        "created_or_prepared": made,
        "already_saved": skipped,
        "refused": refused,
        "requested_start": args.start,
        "requested_end": args.end,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
