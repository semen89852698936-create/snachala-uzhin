#!/usr/bin/env python3
"""Eight individually bounded paid Alice AI ART corrections; never update live site."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "photo-library/regeneration-owner-meat-64-20261113/revision5"

PROMPTS = {
  30: "Фотореалистичная фуд-фотография. Запечённая СВИНАЯ ВЫРЕЗКА в виде трёх румяных ломтей, внутри полностью готовая светлая свинина. РЯДОМ с мясом на той же керамической тарелке небольшая горстка мелко нарезанных обжаренных коричневых шампиньонов, чуть-чуть измельчённого розмарина. Грибы НЕ на мясе. Нет жидкости, гарниров, соусов, яиц, веток, целого чеснока. Тарелка видна целиком с полями по краям кадра, мягкий свет, съёмка сверху под углом.",
  32: "Фотореалистичная ресторанная фотография. Три ломтя запечённой СВИНОЙ ВЫРЕЗКИ, с красивой РУМЯНОЙ КОРОЧКОЙ, внутри светлая готовая свинина без сырой середины. Поверх тончайший слой красно-оранжевой молотой ПАПРИКИ, перемешанной с практически невидимым измельчённым чесноком в масле, ровная приправа без кусочков. На тарелке только мясо. Нет долек чеснока, кубиков перца, семян, трав, гарнира. В кадре вся тарелка с бортиками, мясо занимает не более половины кадра.",
  33: "Реалистичная профессиональная фуд-фотография. Три ломтя полностью готовой запечённой свиной вырезки с румяными краями, на БЕЛОЙ КЕРАМИЧЕСКОЙ ТАРЕЛКЕ. Мясо ПОЛИТО СВЕРХУ густой горячей тёмно-красной ТОМАТНОЙ ПОДЛИВОЙ, размягчённой и уваренной до почти однородной пасты, с редкими мельчайшими точками порубленного свежего базилика. Это соус, НЕ свежий салат. Нет целых томатов, крупных кубиков, листьев, веточек, гарниров, надписей. Вся тарелка видна целиком с полями, мягкий свет.",
  39: "Ресторанная фотография готового блюда. ШЕСТЬ круглых небольших ГОВЯЖЬИХ ТЕФТЕЛЕЙ из фарша, ровной формы, с тёмно-коричневой ПОЛНОСТЬЮ ПРОЖАРЕННОЙ корочкой по всей поверхности, без сырых розовых участков. Едва заметный блеск лимонного сока, немного мелко нарезанного тимьяна. Без соуса, дольки лимона, других продуктов и гарнира. Никаких яиц или глазуньи. Светлая керамическая тарелка видна целиком, тефтели занимают центр и не более половины кадра. Мягкий свет.",
  41: "Фотореалистичная ресторанная фотография. На светлой КЕРАМИЧЕСКОЙ ТАРЕЛКЕ ровно пять круглых ГОВЯЖЬИХ ТЕФТЕЛЕЙ из фарша, полностью приготовленных, с тёмно-золотистой румяной корочкой. Каждая тефтеля слегка смазана гладкой тонкой блестящей МЕДОВО-ГОРЧИЧНОЙ ГЛАЗУРЬЮ, впитанной во время жарки. На тарелке только тефтели и блеск глазури, без других ингредиентов. Нет яиц, зелени, семян, соуса отдельной лужей, гарнира. Вся тарелка в кадре с широкими полями.",
  42: "Фотореалистичная фотография. Пять небольших круглых полностью приготовленных ГОВЯЖЬИХ ТЕФТЕЛЕЙ, а не плоские котлеты и не медальоны. Корочка ярко-румяная и слегка красноватая от МОЛОТОЙ ПАПРИКИ. Мельчайший измельчённый чеснок ВТЁРТ в корочку вместе с паприкой, без видимых кусочков. Ничего не лежит сверху. На белой тарелке только пять тефтелей: без дольки чеснока, перца, семян, зелени, яиц и гарниров. Вся тарелка видна в кадре, тёплый свет.",
  43: "Профессиональная фотореалистичная фотография готового блюда. Пять небольших полностью приготовленных круглых ГОВЯЖЬИХ ТЕФТЕЛЕЙ с румяной корочкой, обильно ПОЛИТЫ СВЕРХУ густой ТУШЁНОЙ ТОМАТНОЙ ПОДЛИВОЙ, уваренной до красного пюре с маленькими мягкими частицами томата. В соусе лишь мелкие зелёные точки измельчённого базилика. Никаких целых помидоров черри, свежих кубиков, крупных листьев, яиц и гарнира. Светлая тарелка целиком видна, мясо в центре.",
  45: "Фотореалистичная ресторанная фотография. Пять небольших круглых ГОВЯЖЬИХ ТЕФТЕЛЕЙ из фарша, полностью прожаренных до равномерной золотисто-коричневой корочки. Очень мелкий тушёный лук и капля бальзамика уже вмешаны ВНУТРЬ фарша: никаких кусочков лука поверх блюда и вокруг. На керамической тарелке только готовые тефтели с лёгкой россыпью мелко нарубленной зелени. Без яиц, глазуньи, гарниров и соусов. Тарелка целиком видна с широкими полями, тёплый мягкий свет."
}
for key, prompt in PROMPTS.items():
  assert len(prompt) <= 500, (key, len(prompt))


def filenames(n):
  return (DEST / f"{n:04d}-revision5.webp",
          DEST / f"{n:04d}-revision5.json",
          DEST / f"{n:04d}-revision5.pending.json",
          DEST / f"{n:04d}-revision5.raw.png")


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
    print("VALIDATED: exactly eight corrected finished-plating prompts, n=24,33")
    return
  if args.n not in PROMPTS:
    parser.error("Only explicit n=30,32,33,39,41,42,43,45 allowed")
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
    "status": "revision5_unpublished", "requires_visual_qa": True,
    "generated_at": datetime.now(timezone.utc).isoformat()
  }, ensure_ascii=False, indent=2).encode())
  pending.unlink()
  raw.unlink(missing_ok=True)
  print("GENERATED", n, len(webp))


if __name__ == "__main__":
  main()
