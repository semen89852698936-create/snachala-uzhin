#!/usr/bin/env python3
"""Exactly one Alice AI ART 3.0 candidate for Shanghai Luo Song Tang #99."""
import hashlib, importlib.util, json, os, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "photo-library/soups/candidates/099/alice-v1"
RESERVATION = OUT / "reserved.json"
PHOTO = OUT / "99-luosongtang-alice-v1.webp"
META = OUT / "metadata.json"
BRANCH = "photo-production/alice-art-soup-99-20261121"
TITLE = "Лосунтан, шанхайский томатный суп"
PROMPT = "Лосунтан (Luo Song Tang), шанхайский густой томатный суп с говядиной. Фотореалистичная фотография готового блюда. Густой красно-оранжевый бульон, мягкие кусочки варёной говядины, кубики картофеля, морковь, тушёная белокочанная капуста, сельдерей, томаты. Все ингредиенты отчётливо видны в одной глубокой керамической тарелке целиком, ракурс 3/4, тёплый дневной свет, деревянный стол. Без яйца, свёклы, сметаны, зелёного лука, сырой зелени, лимона, текста и коллажа."

def git_checkpoint(msg):
    subprocess.run(["git", "add", "--", str(OUT.relative_to(ROOT))], check=True)
    subprocess.run(["git", "commit", "-m", msg], check=True)
    subprocess.run(["git", "push", "origin", "HEAD:refs/heads/" + BRANCH], check=True)

def main():
    if RESERVATION.exists() or PHOTO.exists() or META.exists():
        print("NO_RETRY: candidate or paid reservation already exists")
        return
    assert len(PROMPT) <= 500, f"Prompt too long: {len(PROMPT)}"
    key, folder = os.environ.get("YANDEX_API_KEY"), os.environ.get("YANDEX_FOLDER_ID")
    if not key or not folder or os.environ.get("PHOTO_COST_APPROVED") != "true":
        raise SystemExit("Credentials or explicit cost permission missing; no API call")
    OUT.mkdir(parents=True, exist_ok=True)
    RESERVATION.write_text(json.dumps({
        "recipe_number": 99, "title": TITLE, "model": "aliceai-image-art-3.0",
        "prompt": PROMPT, "state": "paid_request_reserved_no_auto_retry",
        "approval": "pending", "published": False,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    git_checkpoint("Alice AI ART soup 99: reserve one paid request before generation")
    spec = importlib.util.spec_from_file_location(
        "alice_yandex_adapter", ROOT / "_alice_source/photo-pipeline/generate_yandexart.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    image_data = mod.request_image(PROMPT, key, folder)
    webp = mod.encode_webp(image_data)
    PHOTO.write_bytes(webp)
    META.write_text(json.dumps({
        "recipe_number": 99, "title": TITLE,
        "photo_path": str(PHOTO.relative_to(ROOT)),
        "model": "aliceai-image-art-3.0",
        "sha256": hashlib.sha256(webp).hexdigest(), "bytes": len(webp),
        "size": [1200, 900], "prompt": PROMPT,
        "approval": "pending", "published": False
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    git_checkpoint("Alice AI ART soup 99: save unpublished WebP for owner approval")
    print("ALICE_SOUP_99_CANDIDATE_SAVED")

if __name__ == "__main__":
    main()
