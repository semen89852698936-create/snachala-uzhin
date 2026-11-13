#!/usr/bin/env python3
"""Seven individually bounded paid Alice AI ART corrections; never update live site."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "photo-library/regeneration-owner-meat-64-20261113/revision4"

PROMPTS = {
  54: "Профессиональная фотореалистичная фотография готовой еды. Тушёная ГОВЯДИНА небольшими мягкими РУМЯНЫМИ КУСОЧКАМИ, всё мясо покрыто гладким густым тёмно-коричневым глянцевым соусом из выпаренного соевого соуса с растворённой мелкой специей. Видимой приправы нет. На светлой керамической тарелке только тушёная говядина и тёмная подлива, без других продуктов, овощей, веточек, полосок, стружки, семян или гарниров. Полностью приготовленное мясо, мягкий тёплый свет, крупный план.",
  56: "Фотореалистичная ресторанная фуд-фотография. Небольшие сочные РУМЯНЫЕ КУСОЧКИ ТУШЁНОЙ ГОВЯДИНЫ в чистой керамической тарелке, щедро политые нежным слегка загустевшим СВЕТЛО-БЕЖЕВЫМ СЛИВОЧНЫМ СОУСОМ с очень мелкими тёмными крапинками размолотой специи. Только полностью готовые кусочки говядины и этот сливочный соус. Никаких зелёных горошин, колец, стручков, овощей, зелени, трав или гарниров. Аппетитная корочка, мягкий свет, крупный план.",
  84: "Фотореалистичная фотография готового ресторанного блюда. Небольшие нежные КУСОЧКИ ТУШЁНОЙ БАРАНИНЫ с золотисто-коричневой корочкой, мясо полностью готовое. Кусочки равномерно покрыты гладким тёмно-коричневым БЛЕСТЯЩИМ СОУСОМ, соус густой и однородный, без видимых кусочков приправы. На керамической тарелке только баранина в соусе. Никаких соломинок, корней, овощей, зелёных веток, нарезанного лука или гарниров. Мягкий тёплый свет, крупный план.",
  104: "Профессиональная фотореалистичная фуд-фотография. Хорошо обжаренные тонкие ПОЛОСКИ ГОВЯДИНЫ, не круглые медальоны и не кубики. Каждая полоска мяса покрыта ровным блестящим густым тёмно-коричневым соусом, образующим небольшую лужицу на чистой керамической тарелке. Это глянцевая выпаренная подлива без видимых частиц. На тарелке только румяные мясные полоски и соус, никаких соломинок, корней, трав, перца, овощей, семян, гарниров и надписей. Крупный план, мягкий свет.",
  106: "Фотореалистичная ресторанная фотография готовой еды. Тонкие полностью приготовленные ОБЖАРЕННЫЕ ПОЛОСКИ МЯСА с коричневой корочкой, политые густым СВЕТЛЫМ БЕЖЕВЫМ СЛИВОЧНЫМ СОУСОМ с едва заметными мелкими тёмными крапинками размолотой специи. На светлой керамической тарелке только обжаренные мясные полоски и сливочный соус. Нет ни зелёных горошин, ни колец свежего перца, овощей, гарнира, веток или крупной посыпки. Мягкое освещение, аппетитный крупный план.",
  114: "Профессиональная фотореалистичная фотография готового блюда. Две СВИНЫЕ ОТБИВНЫЕ, полностью прожаренные, с красивой золотисто-коричневой корочкой, покрыты тонким ровным слоем ГЛАДКОЙ ТЁМНО-КОРИЧНЕВОЙ СОЕВОЙ ГЛАЗУРИ. Блестящий густой соус приготовлен до однородности и не содержит видимых частиц. Чистая светлая керамическая тарелка, только две свиные отбивные и соус. Нет соломки, корней, кусочков приправы, овощей, трав, гарниров, надписей. Тёплый свет, крупный план.",
  116: "Фотореалистичная фотография полностью приготовленных СВИНЫХ ОТБИВНЫХ. Две румяные свиные отбивные с красивой корочкой, внутри мясо готовое. Они политы густым нежным СВЕТЛО-БЕЖЕВЫМ СЛИВОЧНЫМ СОУСОМ с мельчайшими тёмными крапинками молотой специи. На светлой керамической тарелке только свинина и ровный сливочный соус. Никаких зелёных горошин, перцев, колец, стручков, трав, овощей и гарниров. Аппетитный крупный план, мягкий тёплый свет."
}
for key, prompt in PROMPTS.items():
  assert len(prompt) <= 500, (key, len(prompt))


def filenames(n):
  return (DEST / f"{n:04d}-revision4.webp",
          DEST / f"{n:04d}-revision4.json",
          DEST / f"{n:04d}-revision4.pending.json",
          DEST / f"{n:04d}-revision4.raw.png")


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
    print("VALIDATED: exactly seven corrected finished-plating prompts, n=24,33")
    return
  if args.n not in PROMPTS:
    parser.error("Only explicit n=54,56,84,104,106,114,116 allowed")
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
    "status": "revision4_unpublished", "requires_visual_qa": True,
    "generated_at": datetime.now(timezone.utc).isoformat()
  }, ensure_ascii=False, indent=2).encode())
  pending.unlink()
  raw.unlink(missing_ok=True)
  print("GENERATED", n, len(webp))


if __name__ == "__main__":
  main()
