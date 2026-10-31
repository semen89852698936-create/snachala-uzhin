#!/usr/bin/env python3
"""Recoverable photo generation. Never approves or publishes images."""
import argparse
import base64
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API_URL = "https://api.openai.com/v1/images/generations"
MODEL = "gpt-image-2.5-flare"
OUTPUT_SIZE = "1536x1024"
QUALITY = "medium"
MAX_BYTES = 1_500_000
MIN_BYTES = 20_000


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json_atomic(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def jpeg_size(data):
    if data[:2] != b"\xff\xd8" or data[-2:] != b"\xff\xd9":
        raise ValueError("Not a complete JPEG")
    i = 2
    while i + 4 <= len(data):
        if data[i] != 255:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        size = int.from_bytes(data[i + 2:i + 4], "big")
        if size < 2 or i + 2 + size > len(data):
            raise ValueError("Invalid JPEG segment")
        if marker in (0xC0, 0xC1, 0xC2, 0xC3):
            height = int.from_bytes(data[i + 5:i + 7], "big")
            width = int.from_bytes(data[i + 7:i + 9], "big")
            return width, height
        i += size + 2
    raise ValueError("JPEG dimensions not found")


def make_prompt(recipe):
    names = recipe.get("ingredients") or []
    main = [x for x in names if x and not re.search(r"^(соль|перец|вода от)", x, re.I)][:12]
    return (
        "Create one photorealistic premium food photograph for a Russian romantic cooking website. "
        "Landscape 3:2 framing, food fully visible and safely centered for responsive card cropping. "
        "Mood: warm natural window light, refined understated European food editorial, tactile ceramics, "
        "subtle ivory and dusty beige, restrained wine-red details, natural textures, appetizing yet authentic. "
        "Exactly depict this REAL cooked dish, not a different recipe. "
        "Dish (in Russian): " + recipe["title"] + ". "
        "Core ingredients: " + ", ".join(main) + ". "
        "Recipe description: " + (recipe.get("description") or "")[:350] + ". "
        "Serving instruction: " + (recipe.get("plating") or "")[:240] + ". "
        "Use accurate textures, recipe-specific main ingredients and technique. "
        "No extra meat, seafood, fruit, or sauces unless named; do not use decorative ingredients "
        "that would misrepresent the recipe. One plated serving, not ingredient flat lay. "
        "No people, no packaging, no labels, no lettering, no watermarks, no logos, no collage. "
        "Avoid glossy synthetic CGI look, plastic food, and impossible food geometry."
    )


def request_image(prompt, api_key):
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "n": 1,
        "size": OUTPUT_SIZE,
        "quality": QUALITY,
        "output_format": "jpeg",
        "output_compression": 74
    }
    req = Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + api_key,
                 "Content-Type": "application/json"},
        method="POST"
    )
    with urlopen(req, timeout=240) as response:
        body = json.load(response)
    images = body.get("data") or []
    if not images or not images[0].get("b64_json"):
        raise RuntimeError("The API returned no image data")
    raw = base64.b64decode(images[0]["b64_json"], validate=True)
    if not MIN_BYTES <= len(raw) <= MAX_BYTES:
        raise ValueError("Image size outside permitted limits")
    width, height = jpeg_size(raw)
    if width < 1024 or height < 768:
        raise ValueError("Unexpected image dimensions")
    return raw, width, height


def summarize(manifest, output):
    images_dir = output / "generated"
    records_dir = output / "records"
    counters = {"total": len(manifest), "generated": 0, "approved": 0,
                "pending": 0, "errors": 0, "review_needed": 0}
    for recipe in manifest:
        rid = recipe["id"]
        fp = records_dir / (rid + ".json")
        img = images_dir / (rid + ".jpg")
        if not fp.exists():
            counters["pending"] += 1
            continue
        meta = load_json(fp)
        if meta.get("status") in ("generated_pending_review", "approved") and img.is_file():
            counters["generated"] += 1
            if meta.get("status") == "approved":
                counters["approved"] += 1
            else:
                counters["review_needed"] += 1
        elif meta.get("status") == "error":
            counters["errors"] += 1
        else:
            counters["pending"] += 1
    return counters


def run(args):
    manifest_data = load_json(args.manifest)
    manifest = manifest_data["recipes"]
    ids = [r["id"] for r in manifest]
    if len(manifest) != 1001 or len(set(ids)) != 1001:
        raise ValueError("Expected exactly 1001 distinct recipes")
    if any(not re.fullmatch("[a-z0-9-]+", x) for x in ids):
        raise ValueError("Unexpected recipe identifier")
    if not 1 <= args.max_per_run <= 20 or not 1 <= args.max_total <= 1001:
        raise ValueError("Invalid generation limits")
    output = Path(args.output)
    records_dir = output / "records"
    images_dir = output / "generated"
    stats = summarize(manifest, output)
    remaining_budget = max(0, args.max_total - stats["generated"])
    allowlist = load_json(args.ai_allowlist)
    approved_ids = allowlist.get("recipe_ids", [])
    if not isinstance(approved_ids, list) or not all(isinstance(x, str) for x in approved_ids):
        raise ValueError("AI allowlist must contain recipe_ids list")
    approved_ids = set(approved_ids)
    if allowlist.get("approved_for_ai_generation") is not True:
        approved_ids = set()  # editorial approval gate, independent of workflow flags
    if not approved_ids.issubset(set(ids)):
        raise ValueError("AI allowlist has unknown recipe identifiers")
    candidates = []
    for recipe in manifest:
        # Stock-first rule: no paid AI call without explicit editorial approval.
        if recipe["id"] not in approved_ids:
            continue
        rid = recipe["id"]
        fp = records_dir / (rid + ".json")
        if fp.exists():
            meta = load_json(fp)
            if meta.get("status") in ("generated_pending_review", "approved"):
                if not (images_dir / (rid + ".jpg")).is_file():
                    raise RuntimeError("Missing image for recorded recipe " + rid)
                continue
            if meta.get("status") == "error" and meta.get("attempts", 0) >= 2:
                continue
        candidates.append(recipe)
    candidates = candidates[: min(args.max_per_run, remaining_budget)]
    print("PHOTO_PIPELINE:", json.dumps(
        {"mode": "generate" if args.execute else "plan", **stats,
         "max_per_run": args.max_per_run, "max_total": args.max_total,
         "selected": [x["id"] for x in candidates]}, ensure_ascii=False))
    if not args.execute:
        return 0
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is missing; no images generated")
    records_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)
    for recipe in candidates:
        rid = recipe["id"]
        fp = records_dir / (rid + ".json")
        attempts = (load_json(fp).get("attempts", 0) if fp.exists() else 0) + 1
        prompt = make_prompt(recipe)
        try:
            raw, width, height = request_image(prompt, api_key)
            path = images_dir / (rid + ".jpg")
            tmp = path.with_suffix(".jpg.tmp")
            tmp.write_bytes(raw)
            tmp.replace(path)
            meta = {
                "recipe_id": rid, "title": recipe["title"], "status": "generated_pending_review",
                "review_status": "human_review_required", "rights_status": "ai_output_check_required",
                "origin": "AI generated via OpenAI Images API", "model": MODEL, "quality": QUALITY,
                "size": OUTPUT_SIZE, "image_path": "photo-library/generated/" + rid + ".jpg",
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw), "width": width, "height": height,
                "generated_at": utc_now(), "attempts": attempts,
                "prompt_sha256": hashlib.sha256(prompt.encode("utf-8")).hexdigest()
            }
            write_json_atomic(fp, meta)
            print("GENERATED:", rid, len(raw), "bytes", width, "x", height, flush=True)
        except (HTTPError, URLError, ValueError, RuntimeError) as ex:
            # Never persist API response or secrets in logs.
            write_json_atomic(fp, {
                "recipe_id": rid, "title": recipe["title"],
                "status": "error", "attempts": attempts,
                "error_type": type(ex).__name__, "failed_at": utc_now()
            })
            print("ERROR:", rid, type(ex).__name__, flush=True)
            # Authentication / quota errors: stop immediately, avoid repeated charges.
            if isinstance(ex, HTTPError) and ex.code in (401, 402, 403, 429):
                break
        time.sleep(0.5)
    stats = summarize(manifest, output)
    write_json_atomic(output / "summary.json", {
        "schema_version": 1, **stats, "last_run": utc_now(),
        "status": "generated_images_pending_human_review",
        "production_connected": False,
        "note": "Only files present on disk count as generated. No automatic approvals."
    })
    print("FINAL_SUMMARY:", json.dumps(stats, ensure_ascii=False))
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", default="photo-library/recipes.json")
    p.add_argument("--output", default="photo-library")
    p.add_argument("--ai-allowlist", default="photo-library/ai-allowlist.json")
    p.add_argument("--max-per-run", type=int, default=10)
    p.add_argument("--max-total", type=int, default=50)
    p.add_argument("--execute", action="store_true",
                   help="Calls a paid API. Never enable without explicit cost approval.")
    args = p.parse_args()
    try:
        return run(args)
    except (ValueError, RuntimeError, OSError) as err:
        print("STOP:", str(err), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
