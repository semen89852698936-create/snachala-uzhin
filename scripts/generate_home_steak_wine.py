#!/usr/bin/env python3
"""One-shot owner-requested, text-free steak-and-two-wine-glasses hero photo.

Candidate generation only. Never overwrites an existing photo, never changes
the public site, never retries an uncertain billable generation.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import io
import json
import os
import subprocess
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BRANCH = "feature/editorial-three-scene-spread-20261108"
PHOTO = ROOT / "assets/home-hero-steak-wine-20261108.webp"
RECORD = ROOT / "photo-library/home-hero-steak-wine-20261108.json"
PENDING = ROOT / "photo-library/home-hero-steak-wine-20261108.pending.json"
PROMPT = (
    "Фотореалистичная горизонтальная фуд-фотография для роскошного "
    "кулинарного журнала: сочный говяжий стейк medium rare нарезан "
    "ломтями, розовая середина, розмарин, печёный чеснок и томаты. "
    "СЗАДИ ОБЯЗАТЕЛЬНО ДВА высоких бокала с красным вином, свечи, "
    "бордовая льняная салфетка, немного цветов. Красивый вечерний "
    "деревянный стол. Глубокие шоколадные тени, живой тёплый янтарный "
    "свет, дорогая ресторанная подача. Широкий план, мясо внизу, "
    "бокалы вверху. Только фото: никаких букв, надписей, интерфейса."
)

def checkpoint(paths, message):
    for path in paths:
        subprocess.run(["git", "add", "-A", str(path.relative_to(ROOT))],
                       check=True, cwd=ROOT)
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode:
        subprocess.run(["git", "commit", "-m", message], check=True, cwd=ROOT)
        subprocess.run(["git", "push", "origin", "HEAD:refs/heads/"+BRANCH],
                       check=True, cwd=ROOT)

def execute():
    assert len(PROMPT) <= 500, f"Prompt too long: {len(PROMPT)}"
    if PHOTO.exists() and RECORD.exists():
        data = json.loads(RECORD.read_text("utf-8"))
        assert data["sha256"] == hashlib.sha256(PHOTO.read_bytes()).hexdigest()
        with Image.open(PHOTO) as im:
            im.verify()
        print("READY: image already exists. No extra charge.")
        return
    if PHOTO.exists() or RECORD.exists() or PENDING.exists():
        raise RuntimeError("Image/record/pending already present; no retry or overwrite.")
    assert os.getenv("PHOTO_COST_APPROVED") == "true", "Paid call not authorized"
    key = os.environ["YANDEX_API_KEY"]
    folder = os.environ["YANDEX_FOLDER_ID"]
    PENDING.parent.mkdir(parents=True, exist_ok=True)
    PENDING.write_text(json.dumps({
        "state": "paid_request_pending_or_sent",
        "prompt": PROMPT,
        "requested_at": datetime.now(timezone.utc).isoformat()
    }, ensure_ascii=False, indent=2), "utf-8")
    checkpoint([PENDING], "photo: reserve one-time owner-requested homepage image")
    payload = json.dumps({
        "model": f"art://{folder}/aliceai-image-art-3.0",
        "prompt": PROMPT,
        "size": "1536x1024",
        "n": 1
    }, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        "https://ai.api.cloud.yandex.net/v1/images/generations",
        method="POST", data=payload, headers={
            "Authorization": "Api-Key "+key,
            "OpenAI-Project": folder,
            "Content-Type": "application/json",
            "User-Agent": "SnachalaUzhinOneoffHero/1.0"
        }
    )
    # Intentionally no HTTP retries. Failed/uncertain responses keep PENDING.
    with urllib.request.urlopen(request, timeout=180) as response:
        body = json.load(response)
    raw = base64.b64decode(body["data"][0]["b64_json"], validate=True)
    with Image.open(io.BytesIO(raw)) as im:
        assert im.width >= 1200 and im.height >= 800
        im = ImageOps.exif_transpose(im).convert("RGB")
        im = ImageOps.fit(im, (1400, 900), method=Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="WEBP", quality=88, method=6)
        blob = buf.getvalue()
    assert len(blob) >= 20000 and blob[:4] == b"RIFF" and blob[8:12] == b"WEBP"
    PHOTO.parent.mkdir(parents=True, exist_ok=True)
    PHOTO.write_bytes(blob)
    RECORD.write_text(json.dumps({
        "image": PHOTO.relative_to(ROOT).as_posix(),
        "sha256": hashlib.sha256(blob).hexdigest(),
        "bytes": len(blob), "width": 1400, "height": 900,
        "prompt": PROMPT,
        "model": "aliceai-image-art-3.0",
        "status": "candidate_unpublished",
        "visual_approval": False,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }, ensure_ascii=False, indent=2), "utf-8")
    PENDING.unlink()
    checkpoint([PHOTO, RECORD, PENDING],
               "photo: store expressive steak and two wine glasses candidate")
    print(f"CANDIDATE_SAVED {PHOTO.relative_to(ROOT)} size={len(blob)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    assert len(PROMPT) <= 500, f"Prompt too long: {len(PROMPT)}"
    print("READY_PROMPT "+str(len(PROMPT))+" characters")
    if args.execute:
        execute()
    else:
        print("DRY_RUN: No image generation, no API cost.")
