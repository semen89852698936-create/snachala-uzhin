#!/usr/bin/env python3
"""Create exactly one unpublished Alice AI ART candidate for Russian soup #10."""
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "photo-library" / "soups" / "candidates" / "010" / "v1"
RESERVATION = OUT / "reserved.json"
PHOTO = OUT / "10-gribnaya-pokhlebka-perlovka-v1.webp"
META = OUT / "metadata.json"
BRANCH = "photo-production/alice-art-soup-10-20261119"
PROMPT = "Грибная похлёбка с перловкой из сушёных белых грибов, русский суп. Профессиональная фотореалистичная фотография ГОТОВОГО блюда: прозрачный насыщенный коричнево-золотистый грибной отвар, много небольших тёмно-коричневых кусочков отваренных белых грибов, чёткие небольшие зёрна мягкой перловки, немного картофеля, мелко нарезанные лук и морковь, щепотка укропа. Без сливок, сметаны, сыра, шампиньонов, крупных украшений. Глубокая керамическая тарелка целиком, 3/4, мягкий дневной свет. Без текста."

def save(message):
    subprocess.run(["git", "add", "--", str(OUT.relative_to(ROOT))], check=True)
    subprocess.run(["git", "commit", "-m", message], check=True)
    subprocess.run(["git", "push", "origin", "HEAD:refs/heads/" + BRANCH], check=True)

def main():
    if RESERVATION.exists() or PHOTO.exists():
        print("SKIPPED: pre-existing candidate or reserved paid request; no retry")
        return
    assert len(PROMPT) <= 500, len(PROMPT)
    key, folder = os.environ.get("YANDEX_API_KEY"), os.environ.get("YANDEX_FOLDER_ID")
    if not key or not folder:
        raise SystemExit("Missing Yandex credentials, no paid requests made.")
    OUT.mkdir(parents=True, exist_ok=True)
    RESERVATION.write_text(json.dumps({
        "collection": "soups", "recipe_number": 10,
        "title": "Грибная похлёбка с перловкой",
        "prompt": PROMPT, "state": "paid_request_reserved",
        "approval": "pending", "published": False
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    save("Reserve one paid Alice AI ART call for Russian soup 10")
    spec = importlib.util.spec_from_file_location("alice_art", ROOT / "photo-pipeline" / "generate_yandexart.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    raw = module.request_image(PROMPT, key, folder)
    webp = module.encode_webp(raw)
    PHOTO.write_bytes(webp)
    META.write_text(json.dumps({
        "recipe_number": 10, "title": "Грибная похлёбка с перловкой",
        "sha256": hashlib.sha256(webp).hexdigest(),
        "dimensions": [1200, 900], "prompt": PROMPT,
        "approval": "pending", "published": False
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    save("Save unpublished Alice AI ART candidate for Russian soup 10")
    print("CREATED: soup 10 candidate for owner approval")

if __name__ == "__main__":
    main()
