#!/usr/bin/env python3
"""One unpublished Alice AI ART 3.0 candidate for soup #9, without retries."""
import hashlib, importlib.util, json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "photo-library" / "soups" / "candidates" / "009" / "v1"
RESERVATION = OUT / "reserved.json"
PHOTO = OUT / "09-rybnaya-kalya-v1.webp"
META = OUT / "metadata.json"
BRANCH = "photo-production/alice-art-soup-09-20261119"
PROMPT = (
    "Рыбная калья с солёными огурцами, традиционный русский суп. "
    "Фотореалистичная гастрономическая фотография готовой еды: "
    "прозрачный золотистый бульон, 3 крупных нежно-розовых куска полностью "
    "приготовленного лосося, мелкая соломка солёных огурцов, мягкие лук "
    "и морковь, немного рубленого укропа. Всё уже в суповой тарелке. "
    "Без картофеля, колбасы, маслин, сметаны, грибов, лимонных долек. "
    "Тарелка целиком, ракурс 3/4, тёплый естественный свет, винтажный стол. "
    "Одна фотография, без коллажа и надписей."
)

def save(message):
    subprocess.run(["git", "add", "--", str(OUT.relative_to(ROOT))], check=True)
    subprocess.run(["git", "commit", "-m", message], check=True)
    subprocess.run(["git", "push", "origin", "HEAD:refs/heads/" + BRANCH], check=True)

def main():
    if RESERVATION.exists() or PHOTO.exists():
        print("SKIPPED: existing reservation or photo. No duplicate paid call.")
        return
    assert len(PROMPT) <= 500, len(PROMPT)
    key, folder = os.environ.get("YANDEX_API_KEY"), os.environ.get("YANDEX_FOLDER_ID")
    if not key or not folder:
        raise SystemExit("Missing Yandex credentials; no paid calls performed.")
    OUT.mkdir(parents=True, exist_ok=True)
    RESERVATION.write_text(json.dumps({
        "collection": "soups", "recipe_number": 9,
        "title": "Рыбная калья с солёными огурцами",
        "prompt": PROMPT, "state": "paid_request_reserved",
        "approval": "pending", "published": False
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    save("Reserve one Alice AI ART paid request for Russian soup 09")
    spec = importlib.util.spec_from_file_location(
        "alice_art", ROOT / "photo-pipeline" / "generate_yandexart.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    original = module.request_image(PROMPT, key, folder)
    image = module.encode_webp(original)
    PHOTO.write_bytes(image)
    META.write_text(json.dumps({
        "recipe_number": 9, "title": "Рыбная калья с солёными огурцами",
        "sha256": hashlib.sha256(image).hexdigest(),
        "dimensions": [1200, 900], "prompt": PROMPT,
        "approval": "pending", "published": False
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    save("Save unpublished Alice AI ART photograph of soup 09")
    print("CREATED: soup 09 candidate for owner review")

if __name__ == "__main__":
    main()
