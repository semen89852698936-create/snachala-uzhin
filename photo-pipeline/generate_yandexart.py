#!/usr/bin/env python3
"""Produce recipe-specific Alice AI ART WebP photos for СНАЧАЛА УЖИН.

Default mode is dry-run and FREE. Paid calls require --execute, GitHub secret
YANDEX_API_KEY, YANDEX_FOLDER_ID and PHOTO_COST_APPROVED=true. No site deployment.
Source of truth: photo-library/recipes.json (1001 actual recipes and ingredients).
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
RECIPE_MANIFEST = ROOT / "photo-library" / "recipes.json"
DEST = ROOT / "photo-library" / "alice-ai-art"
MODEL = "aliceai-image-art-3.0"
API_URL = "https://ai.api.cloud.yandex.net/v1/images/generations"
TARGET_SIZE = (1200, 900)
MAX_PROMPT = 500

class ModelImageRefusal(RuntimeError):
    """Yandex explicitly rejected the prompt; no image is available to download."""


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def load_recipes(path=RECIPE_MANIFEST):
    source = json.loads(Path(path).read_text(encoding="utf-8"))
    recipes = source["recipes"]
    assert len(recipes) == 1001, "Expected exactly 1001 records"
    assert len({int(r["n"]) for r in recipes}) == 1001
    assert len({r["id"] for r in recipes}) == 1001
    return sorted(recipes, key=lambda r: int(r["n"]))

def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()

def prompt(recipe):
    """Match the recipe title AND visible ingredients; never prompt a generic category photo."""
    ingredients = [clean(s) for s in recipe.get("ingredients", [])]
    ingredients = [s for s in ingredients if s][:10]
    dish = clean(recipe["title"])
    description = clean(recipe.get("description", ""))
    pieces = [
        "Фотореалистичная премиальная фуд-фотография готового блюда.",
        f"ТОЧНОЕ блюдо: {dish}.",
        "Видимые ингредиенты: " + ", ".join(ingredients) + "." if ingredients else "",
        f"Детали: {description}." if description else "",
        "Аппетитная ресторанная подача на одну-две персоны, светлая керамика,",
        "нежная пастельная сервировка, тёплый мягкий вечерний свет, крупный план.",
        "Блюдо строго в центре кадра; без рук, людей, букв, логотипов, коллажей.",
    ]
    value = " ".join(s for s in pieces if s)
    # The current Alice AI ART image model accepts at most 500 characters.
    if len(value) > MAX_PROMPT:
        value = " ".join(pieces[:3] + pieces[4:])
    return value[:MAX_PROMPT].rstrip(" ,.")

def request_image(prompt_text, key, folder):
    data = json.dumps({
        "model": f"art://{folder}/{MODEL}",
        "prompt": prompt_text,
        "size": "1536x1024",
        "n": 1,
    }, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(API_URL, data=data, method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": f"Api-Key {key}",
        "OpenAI-Project": folder,
        "User-Agent": "SnachalaUzhinPhotoGenerator/1.0",
    })
    # No automatic retries, to prevent duplicate paid generations.
    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            result = json.loads(response.read())
    except urllib.error.HTTPError as error:
        detail = error.read(1600).decode("utf-8", errors="replace")
        try:
            message = json.loads(detail).get("error", {}).get("message", "")
        except (ValueError, AttributeError, TypeError):
            message = detail
        if error.code == 400 and "Я не могу сгенерировать это изображение" in str(message):
            raise ModelImageRefusal(f"Yandex model refused the prompt: {message}") from error
        raise RuntimeError(f"Yandex API HTTP {error.code}: {detail}") from error
    encoded = result["data"][0].get("b64_json")
    if not encoded:
        raise RuntimeError("Image API did not return b64_json")
    return base64.b64decode(encoded, validate=True)

def encode_webp(image_data):
    with Image.open(io.BytesIO(image_data)) as im:
        im.load()
        if im.width < 900 or im.height < 700:
            raise RuntimeError(f"Generated image too small: {im.size}")
        im = ImageOps.exif_transpose(im).convert("RGB")
        output = ImageOps.fit(im, TARGET_SIZE, method=Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        output.save(buffer, "WEBP", quality=88, method=6)
    return buffer.getvalue()

def atomic_write(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(content)
    tmp.replace(path)

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--end", type=int, default=1001)
    parser.add_argument("--limit", type=int, default=10, help="Max paid calls per run (1-100)")
    parser.add_argument("--execute", action="store_true", help="Enables paid API calls")
    parser.add_argument("--output", type=Path, default=DEST)
    args = parser.parse_args(argv)
    if not (1 <= args.start <= args.end <= 1001):
        parser.error("start/end must be between 1 and 1001")
    if not (1 <= args.limit <= 100):
        parser.error("limit must be 1..100")
    if args.execute:
        if os.getenv("PHOTO_COST_APPROVED") != "true":
            parser.error("Set PHOTO_COST_APPROVED=true to permit paid API calls")
        if not os.getenv("YANDEX_API_KEY") or not os.getenv("YANDEX_FOLDER_ID"):
            parser.error("Set YANDEX_API_KEY and YANDEX_FOLDER_ID via GitHub Secrets")
    recipes = [r for r in load_recipes() if args.start <= int(r["n"]) <= args.end]
    made = skipped = 0
    for r in recipes:
        n, recipe_id = int(r["n"]), r["id"]
        output = args.output / "photos" / f"{n:04d}-{recipe_id}.webp"
        record_path = args.output / "records" / f"{n:04d}-{recipe_id}.json"
        if output.is_file() and record_path.is_file():
            record = json.loads(record_path.read_text(encoding="utf-8"))
            with Image.open(output) as existing_image:
                existing_image.verify()
            if hashlib.sha256(output.read_bytes()).hexdigest() != record.get("sha256"):
                raise RuntimeError(f"Existing photo hash mismatch: {output}")
            skipped += 1
            continue
        if output.exists() != record_path.exists():
            raise RuntimeError(f"Partially saved image, recovery needed: {output}")
        if made >= args.limit:
            break
        p = prompt(r)
        if not args.execute:
            print(json.dumps({"n": n, "title": r["title"], "prompt": p, "would_generate": True}, ensure_ascii=False))
            made += 1
            continue
        # Exactly one API request per attempted recipe. Failure stops the batch.
        pending = args.output / "uncertain" / f"{n:04d}-{recipe_id}.json"
        rejected = args.output / "rejected" / f"{n:04d}-{recipe_id}.json"
        if rejected.exists():
            print(f"SKIP_REFUSED {n} {recipe_id}", flush=True)
            continue
        raw_path = args.output / "raw-checkpoint" / f"{n:04d}-{recipe_id}.png"
        if raw_path.exists():
            # A previous run already paid for the result; finish encoding without a new request.
            raw = raw_path.read_bytes()
            print(f"RECOVER_RAW {n} {recipe_id}", flush=True)
        else:
            if pending.exists():
                marker = json.loads(pending.read_text(encoding="utf-8"))
                if marker.get("status") == "model_refusal_400_no_image":
                    atomic_write(rejected, json.dumps({
                        "n": n, "recipe_id": recipe_id, "title": r["title"],
                        "prompt": p, "status": "refused_by_model",
                        "created_at": utc_now(), "owner_review_required": True,
                        "reason": "Yandex HTTP 400: Я не могу сгенерировать это изображение"
                    }, ensure_ascii=False, indent=2).encode())
                    pending.unlink(missing_ok=True)
                    made += 1
                    print(f"MODEL_REFUSAL_ARCHIVED {n} {recipe_id}", flush=True)
                    continue
                if marker.get("status") != "known_response_discarded_by_old_size_gate":
                    print(f"SKIP_UNCERTAIN {n} {recipe_id}", flush=True)
                    continue
                print(f"REGENERATE_KNOWN_LOST_IMAGE {n} {recipe_id}", flush=True)
            atomic_write(pending, json.dumps({
                "n": n, "recipe_id": recipe_id, "status": "request_pending_or_sent",
                "created_at": utc_now(),
                "note": "If output is missing after failure, do not automatically re-request."
            }, ensure_ascii=False, indent=2).encode())
            try:
                raw = request_image(p, os.environ["YANDEX_API_KEY"], os.environ["YANDEX_FOLDER_ID"])
            except ModelImageRefusal as error:
                atomic_write(rejected, json.dumps({
                    "n": n, "recipe_id": recipe_id, "title": r["title"],
                    "prompt": p, "status": "refused_by_model",
                    "created_at": utc_now(), "owner_review_required": True,
                    "reason": str(error)
                }, ensure_ascii=False, indent=2).encode())
                pending.unlink(missing_ok=True)
                made += 1
                print(f"MODEL_REFUSAL_ARCHIVED {n} {recipe_id}", flush=True)
                continue
            # Save the actual paid result before image decoding/cropping can fail.
            atomic_write(raw_path, raw)
        webp = encode_webp(raw)
        sha = hashlib.sha256(webp).hexdigest()
        # Save photo before writing metadata, preserving original photo in case metadata write fails.
        atomic_write(output, webp)
        record = {
            "n": n, "recipe_id": recipe_id, "title": r["title"],
            "ingredients": r.get("ingredients", []), "prompt": p,
            "path": str(output.relative_to(ROOT)) if output.is_relative_to(ROOT) else str(output),
            "sha256": sha, "bytes": len(webp), "size": list(TARGET_SIZE),
            "model": MODEL, "generated_at": utc_now(), "status": "generated_unpublished",
            "approved_for_publication": False,
        }
        atomic_write(record_path, json.dumps(record, ensure_ascii=False, indent=2).encode())
        pending.unlink(missing_ok=True)
        raw_path.unlink(missing_ok=True)
        made += 1
        print(f"GENERATED {n} {recipe_id} sha256={sha} bytes={len(webp)}", flush=True)
    print(json.dumps({"mode": "execute" if args.execute else "dry-run",
                      "prepared_or_created": made, "already_saved": skipped,
                      "requested_start": args.start, "requested_end": args.end}, ensure_ascii=False))

if __name__ == "__main__":
    main()
