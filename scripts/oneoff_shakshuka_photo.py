#!/usr/bin/env python3
"""One explicitly authorized Yandex AI photo request for shakshuka #19.

Only creates a candidate image and record, never changes the live catalog.
The existing photo remains untouched. No scheduled paid calls and no repeats.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "_photo_source"
DEST = ROOT / "photo-library" / "shakshuka-oneoff-20261105"
IMAGE = DEST / "0019-shakshuka-candidate.webp"
RECORD = DEST / "0019-shakshuka-candidate.json"
PENDING = DEST / "0019-shakshuka.pending.json"
NUMBER = 19
RECIPE_ID = "shakshuka"
SCRIPT_RE = re.compile(r'(<script\s+id="recipeData"\s+type="application/json">)(.*?)(</script>)', re.S)

PROMPT = (
    "Фотореалистичная премиальная фуд-фотография настоящей шакшуки. "
    "ЧУГУННАЯ СКОВОРОДА: густой красный соус из тушёных помидоров, "
    "мелко нарезанного сладкого перца и лука с чесноком, паприкой и зирой. "
    "РОВНО ЧЕТЫРЕ яйца разбиты в четыре углубления ПРЯМО В ОВОЩНОМ СОУСЕ, "
    "белки схватились, желтки видны. Никакой отдельной яичницы, омлета, "
    "яиц поверх гарнира, риса или мяса. Сверху рубленая петрушка. "
    "Подача горячей в сковороде, рядом хлеб, тёплый мягкий ресторанный свет. "
    "Крупный план, без текста и людей."
)


def run_git(*args):
    subprocess.run(["git", *args], cwd=ROOT, check=True)


def checkpoint(paths, message):
    for path in paths:
        run_git("add", "-A", str(path.relative_to(ROOT)))
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode:
        run_git("commit", "-m", message)
        run_git("push", "origin", "HEAD:refs/heads/main")


def validate_source():
    assert len(PROMPT) <= 500, f"Prompt exceeds Yandex image limit: {len(PROMPT)}"
    spec = importlib.util.spec_from_file_location(
        "yandex_images", SOURCE / "photo-pipeline" / "generate_yandexart.py"
    )
    assert spec and spec.loader, "Generator source unavailable"
    ym = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ym)
    recipes = ym.load_recipes(SOURCE / "photo-library" / "recipes.json")
    recipe = recipes[NUMBER - 1]
    assert int(recipe["n"]) == NUMBER and recipe["id"] == RECIPE_ID
    assert "шакшук" in recipe["title"].lower()
    for catalog in ("index.html", "full-catalog/index.html"):
        html = (ROOT / catalog).read_text(encoding="utf-8")
        match = SCRIPT_RE.search(html)
        assert match, f"{catalog}: missing recipe JSON"
        data = json.loads(match.group(2))
        assert len(data) == 1001
        item = data[NUMBER - 1]
        assert item["id"] == RECIPE_ID
        assert item["photo"] == "/assets/recipes-ai/0019-shakshuka.webp", (
            catalog, "unexpected pre-existing photo update", item["photo"]
        )
        assert len([x for x in item["ingredients"] if "яйц" in x["name"].lower()]) == 1
        assert next(x["amount"] for x in item["ingredients"] if "яйц" in x["name"].lower()) == 4
    return ym


def generate(ym):
    if RECORD.exists():
        rec = json.loads(RECORD.read_text(encoding="utf-8"))
        blob = IMAGE.read_bytes()
        assert rec["sha256"] == hashlib.sha256(blob).hexdigest()
        print("ALREADY_GENERATED: no repeat charge", flush=True)
        return
    if PENDING.exists():
        raise RuntimeError("Unresolved paid request. Never repeat automatically.")
    if IMAGE.exists():
        raise RuntimeError("Image without record; do not overwrite it.")
    assert os.environ.get("PHOTO_COST_APPROVED") == "true"
    key = os.environ["YANDEX_API_KEY"]
    folder = os.environ["YANDEX_FOLDER_ID"]
    DEST.mkdir(parents=True, exist_ok=True)
    ym.atomic_write(PENDING, json.dumps({
        "n": NUMBER, "recipe_id": RECIPE_ID,
        "prompt": PROMPT, "status": "request_pending_or_sent",
        "created_at": datetime.now(timezone.utc).isoformat()
    }, ensure_ascii=False, indent=2).encode())
    # Commit reservation BEFORE paid request to prevent duplicate charges on retries.
    checkpoint([PENDING], "Reserve one-time Yandex shakshuka image request (#19)")
    raw = ym.request_image(PROMPT, key, folder)
    webp = ym.encode_webp(raw)
    assert len(webp) > 20000 and webp[:4] == b"RIFF" and webp[8:12] == b"WEBP"
    ym.atomic_write(IMAGE, webp)
    ym.atomic_write(RECORD, json.dumps({
        "n": NUMBER, "recipe_id": RECIPE_ID,
        "title": "Шакшука с томатами и перцем",
        "path": str(IMAGE.relative_to(ROOT)),
        "bytes": len(webp), "sha256": hashlib.sha256(webp).hexdigest(),
        "prompt": PROMPT, "generator": "aliceai-image-art-3.0",
        "status": "generated_candidate_not_published",
        "visually_verified": False,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }, ensure_ascii=False, indent=2).encode())
    PENDING.unlink()
    checkpoint([IMAGE, RECORD, PENDING], "Save one-time shakshuka candidate, keep live image unchanged")
    print(f"CANDIDATE_READY {IMAGE.relative_to(ROOT)} {len(webp)} bytes", flush=True)


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("--execute", action="store_true")
    args = cli.parse_args()
    generator = validate_source()
    print(f"SHakshuka #19 verified. Prompt={len(PROMPT)} characters", flush=True)
    if args.execute:
        generate(generator)
    else:
        print("DRY_RUN_ONLY: no paid generation, no files modified", flush=True)
