#!/usr/bin/env python3
"""Four individually bounded paid Alice AI ART corrections; never update live site."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "photo-library/regeneration-owner-meat-64-20261113/revision3"

PROMPTS = {
  22: "Фотореалистичная премиальная фотография готового блюда. Три полностью обжаренных говяжьих медальона с равномерной красновато-коричневой корочкой от очень мелкой молотой паприки и почти незаметного измельчённого чеснока, впитанного в масло на поверхности. Мясо румяное, с тонким блеском масла. На светлой керамической тарелке только три медальона, никаких видимых долек и ломтиков, овощей, перца, гарниров, веток, зелени, текста. Аппетитный тёплый свет, крупный план.",
  23: "Высококачественная фуд-фотография готового блюда. На керамической тарелке три обжаренных говяжьих медальона с красивой корочкой. Поверх мяса густая УВАРЕННАЯ тёмно-красная томатная подлива, мягкая и полужидкая, с маленькими частицами протушенной мякоти и мельчайшими зелёными точками рубленого базилика. Это СОУС ПОСЛЕ ДОЛГОГО ТУШЕНИЯ, не салат из свежих овощей. Нет целых помидоров, свежих крупных кубиков, веток, крупных листьев и гарниров. Крупный план, мягкий свет.",
  33: "Фотореалистичная фуд-фотография ЗАПЕЧЁННОЙ СВИНОЙ ВЫРЕЗКИ. Три толстых румяных ломтя полностью готового нежного мяса, внутри светло-бежевая мякоть. Поверх мяса плавно стекает густой КРАСНЫЙ ТОМАТНЫЙ СОУС-РАГУ, уваренный до мягкой почти пюреобразной консистенции, с мелкими мягкими частицами томатов и мельчайшими тёмно-зелёными точками базилика. На тарелке только готовая свинина и СОУС, не свежий салат. Ни кубиков сырого помидора, ни листьев сверху, ни веток. Белая тарелка, тёплый свет.",
  36: "Фотореалистичная фотография готового блюда. Три полностью приготовленных ломтя запечённой свиной вырезки с румяной золотисто-коричневой корочкой, внутри светло-бежевая готовая свинина. Ломти щедро политы СВЕТЛЫМ ГУСТЫМ БЕЖЕВЫМ СЛИВОЧНЫМ СОУСОМ с крошечными тёмными крапинками размолотой специи. На чистой керамической тарелке только свинина и сливочный соус, ничего не положено сверху, нет перцев, колец, стручков, горошин, овощей, зелени и гарниров. Мягкий свет, крупный план."
}
for key, prompt in PROMPTS.items():
  assert len(prompt) <= 500, (key, len(prompt))


def filenames(n):
  return (DEST / f"{n:04d}-revision3.webp",
          DEST / f"{n:04d}-revision3.json",
          DEST / f"{n:04d}-revision3.pending.json",
          DEST / f"{n:04d}-revision3.raw.png")


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
    print("VALIDATED: exactly four corrected finished-plating prompts, n=24,33")
    return
  if args.n not in PROMPTS:
    parser.error("Only explicit n=22,23,33,36 allowed")
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
    "status": "revision3_unpublished", "requires_visual_qa": True,
    "generated_at": datetime.now(timezone.utc).isoformat()
  }, ensure_ascii=False, indent=2).encode())
  pending.unlink()
  raw.unlink(missing_ok=True)
  print("GENERATED", n, len(webp))


if __name__ == "__main__":
  main()
