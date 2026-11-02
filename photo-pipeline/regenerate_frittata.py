#!/usr/bin/env python3
"""Regenerate exactly one frittata photo, without publishing an unreviewed result."""
import importlib.util
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("yandex", ROOT / "photo-pipeline" / "generate_yandexart.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
matches = [r for r in mod.load_recipes() if "фриттат" in r["title"].lower()]
if len(matches) != 1:
    raise SystemExit(f"Expected exactly one frittata recipe, found {len(matches)}")
recipe = matches[0]
prompt = (
    "Фотореалистичная итальянская фриттата, запечённый омлет одним цельным пластом. "
    "Яйца полностью смешаны с начинкой и равномерно схватились, поверхность золотистая, "
    "сыр и овощи внутри омлета. Вид под углом 45 градусов, крупный план, керамическая форма, "
    "мягкий кинематографический свет, натуральная ресторанная фуд-фотография. "
    "СТРОГО ЗАПРЕЩЕНЫ: глазунья, жареные яйца сверху, отдельные желтки, "
    "целые яйца на поверхности, яйца пашот, sunny-side-up, яичница, коллаж, текст."
)
assert len(prompt) <= 500, len(prompt)
if os.environ.get("PHOTO_COST_APPROVED") != "true":
    raise SystemExit("Paid generation not approved in environment")
key = os.environ["YANDEX_API_KEY"]
folder = os.environ["YANDEX_FOLDER_ID"]
n, rid = int(recipe["n"]), recipe["id"]
out = ROOT / "photo-library" / "frittata-review"
out.mkdir(parents=True, exist_ok=True)
img = out / f"{n:04d}-{rid}-candidate.webp"
meta = out / f"{n:04d}-{rid}-candidate.json"
if img.exists():
    raise SystemExit(f"Candidate already generated, refusing duplicate paid call: {img}")
raw = mod.request_image(prompt, key, folder)
webp = mod.encode_webp(raw)
mod.atomic_write(img, webp)
import hashlib
mod.atomic_write(meta, json.dumps({
    "recipe_n": n, "recipe_id": rid, "title": recipe["title"],
    "prompt": prompt, "sha256": hashlib.sha256(webp).hexdigest(),
    "status": "candidate_requires_visual_review",
    "publish": False
}, ensure_ascii=False, indent=2).encode())
print(f"Saved single candidate {img} for {recipe['title']}")
