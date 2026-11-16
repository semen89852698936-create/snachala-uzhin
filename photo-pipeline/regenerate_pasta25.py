#!/usr/bin/env python3
"""Generate exactly one unpublished Alice AI ART candidate for Pasta #68.

Run in GitHub Actions with the existing YANDEX_API_KEY/YANDEX_FOLDER_ID secrets.
A persistent reservation blocks repeat paid requests after an uncertain failure.
Never changes published site assets or the original 1001-photo collection.
"""
from pathlib import Path
import hashlib, importlib.util, json, os, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
RECIPE_NUMBER = 380
RECIPE_ID = "collection-pasta-07-08"
OUT = ROOT / "photo-library" / "pasta-replacements" / "068" / "v1"
RESERVATION = OUT / "reserved.json"
PHOTO = OUT / "orecchiette-sweet-pepper-paprika-candidate.webp"
META = OUT / "metadata.json"

def git_save(message):
    subprocess.run(["git", "add", "--", str(OUT.relative_to(ROOT))], check=True)
    subprocess.run(["git", "commit", "-m", message], check=True)
    subprocess.run(["git", "push", "origin", "HEAD:refs/heads/photo-production/pasta-25-targeted-20261116"], check=True)

def main():
    if RESERVATION.exists() or PHOTO.exists():
        print("SKIPPED: existing candidate or paid-call reservation; no retry")
        return
    key = os.environ.get("YANDEX_API_KEY")
    folder = os.environ.get("YANDEX_FOLDER_ID")
    if not key or not folder:
        raise SystemExit("Missing Yandex secret. No image generation attempted.")
    recipes = json.loads((ROOT / "photo-library" / "recipes.json").read_text(encoding="utf-8"))["recipes"]
    recipe = next(r for r in recipes if r["n"] == RECIPE_NUMBER)
    assert recipe["id"] == RECIPE_ID and recipe["title"] == "Орекьетте с сладким перцем и паприкой"
    prompt = (
        "Фото: Орекьетте со сладким перцем и паприкой. "
        "ГЛАВНОЕ: 70% блюда занимают ОРЕКЬЕТТЕ, "
        "маленькие круглые ВОГНУТЫЕ ушки-чашечки с толстыми "
        "краями и выемкой вверх; НЕ ракушки и НЕ трубочки. "
        "МНОГО обжаренных кусочков КРАСНОГО и ЖЁЛТОГО болгарского "
        "перца между ушками и сверху; перец не скрывает пасту. "
        "Лёгкий масляный соус с оттенком сладкой паприки, "
        "без кучек сухих специй. НЕТ КУСКОВ И ПЛАСТИН СЫРА. "
        "Пармезан лишь мелкой тёртой пылью. "
        "Светлая тарелка почти целиком, ракурс 3/4, мягкий свет."
    )
    assert len(prompt) <= 500
    OUT.mkdir(parents=True, exist_ok=True)
    RESERVATION.write_text(json.dumps({"recipe_number": RECIPE_NUMBER, "recipe_id": RECIPE_ID, "prompt": prompt, "state": "paid_request_reserved"}, ensure_ascii=False, indent=2), encoding="utf-8")
    git_save("Reserve one paid Alice AI ART candidate for Pasta 68")
    spec = importlib.util.spec_from_file_location("alice_art", ROOT / "photo-pipeline" / "generate_yandexart.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    raw = module.request_image(prompt, key, folder)
    webp = module.encode_webp(raw)
    PHOTO.write_bytes(webp)
    META.write_text(json.dumps({"recipe_number": RECIPE_NUMBER, "recipe_id": RECIPE_ID, "title": recipe["title"], "sha256": hashlib.sha256(webp).hexdigest(), "prompt": prompt, "approval": "pending", "published": False}, ensure_ascii=False, indent=2), encoding="utf-8")
    git_save("Save unpublished Alice AI ART candidate for Pasta 68")
    print("CREATED unpublished Pasta 64 candidate")

if __name__ == "__main__":
    main()
