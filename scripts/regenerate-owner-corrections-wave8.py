#!/usr/bin/env python3
"""One individually bounded paid Alice AI ART corrections; never update live site."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "photo-library/regeneration-owner-meat-64-20261113/revision8"

PROMPTS = {
  43: "Фотореалистичная фуд-фотография. Пять небольших круглых хорошо прожаренных говяжьих тефтелей из фарша на полностью видимой кремовой керамической тарелке. На каждой тефтеле сверху немного густого тёмно-красного томатного соуса-рагу с мелко перетёртыми тушёными томатами. Между тефтелями тарелка чистая, соус не растекается. Слегка припорошить мелко нарубленным свежим базиликом. Мягкий тёплый свет, натуральная аппетитная подача, никакой гарнир."
}
for key, prompt in PROMPTS.items():
  assert len(prompt) <= 500, (key, len(prompt))


def filenames(n):
  return (DEST / f"{n:04d}-revision8.webp",
          DEST / f"{n:04d}-revision8.json",
          DEST / f"{n:04d}-revision8.pending.json",
          DEST / f"{n:04d}-revision8.raw.png")


def status(n):
  photo, record, pending, raw = filenames(n)
  if photo.exists() and record.exists():
    data = json.loads(record.read_text(encoding="utf-8"))
    assert hashlib.sha256(photo.read_bytes()).hexdigest() == data["sha256"]
    return "DONE"
  if photo.exists() or record.exists():
    raise RuntimeError("Incomplete photo / record for n=" + str(n))
  if pending.exists() or raw.exists():
    return "PENDING"
  return "NEW"


def main():
  parser = argparse.ArgumentParser()
  parser.add_argument("--mode", choices=["validate", "status", "reserve", "execute"], required=True)
  parser.add_argument("--n", type=int)
  args = parser.parse_args()
  if args.mode == "validate":
    print("VALIDATED: exactly one corrected finished-plating prompts, n=24,33")
    return
  if args.n not in PROMPTS:
    parser.error("Only explicit n=43 allowed")
  n = args.n
  photo, record, pending, raw = filenames(n)
  state = status(n)
  if args.mode == "status":
    print(state)
    return
  if args.mode == "reserve":
    if state == "NEW":
      pending.parent.mkdir(parents=True, exist_ok=True)
      pending.write_text(json.dumps({
        "n": n, "status": "paid_request_reserved_once",
        "prompt": PROMPTS[n], "timestamp": datetime.now(timezone.utc).isoformat(),
        "photo_not_published": True
      }, ensure_ascii=False, indent=2), encoding="utf-8")
      print("RESERVED", n)
      return
    raise RuntimeError("Cannot reserve existing state " + state)
  if state == "DONE":
    print("SKIP_DONE", n)
    return
  if state != "PENDING" or not pending.exists():
    raise RuntimeError("Must reserve and commit before executing")
  if os.environ.get("PHOTO_COST_APPROVED") != "true":
    raise RuntimeError("Paid call not approved")
  if not os.environ.get("YANDEX_API_KEY") or not os.environ.get("YANDEX_FOLDER_ID"):
    raise RuntimeError("Missing Yandex secrets")
  spec = importlib.util.spec_from_file_location(
    "ym", ROOT / "_photo_source/photo-pipeline/generate_yandexart.py")
  ym = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(ym)
  if not raw.exists():
    payload = ym.request_image(PROMPTS[n],
                               os.environ["YANDEX_API_KEY"],
                               os.environ["YANDEX_FOLDER_ID"])
    ym.atomic_write(raw, payload)
  webp = ym.encode_webp(raw.read_bytes())
  ym.atomic_write(photo, webp)
  ym.atomic_write(record, json.dumps({
    "n": n, "prompt": PROMPTS[n],
    "sha256": hashlib.sha256(webp).hexdigest(),
    "bytes": len(webp), "model": "aliceai-image-art-3.0",
    "status": "revision8_unpublished", "requires_visual_qa": True,
    "generated_at": datetime.now(timezone.utc).isoformat()
  }, ensure_ascii=False, indent=2).encode())
  pending.unlink()
  raw.unlink(missing_ok=True)
  print("GENERATED", n, len(webp))


if __name__ == "__main__":
  main()
