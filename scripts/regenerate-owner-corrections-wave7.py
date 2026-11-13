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
DEST = ROOT / "photo-library/regeneration-owner-meat-64-20261113/revision7"

PROMPTS = {
  32: "Фуд-фотография готового блюда крупно, но вся светлая тарелка с бортиками видна. На ней четыре толстых ломтика ЗАПЕЧЁННОЙ СВИНОЙ ВЫРЕЗКИ, внутри светлая готовая мякоть. У всех ломтиков аппетитная сухая ровная КРАСНО-РЫЖАЯ КОРОЧКА из мелкой молотой паприки и пряного масла. На поверхности нет отдельных частиц, только ровный тонкий слой специй. Тарелка чистая, без декоративных продуктов и зелени, минимум мясного сока. Естественный мягкий свет, ракурс сверху под углом.",
  33: "Классическая ресторанная фотография. На красивой круглой белой тарелке ТРИ ломтика ПОЛНОСТЬЮ ГОТОВОЙ запечённой свиной вырезки с коричневой корочкой. На середине КАЖДОГО ломтика по одной столовой ложке очень густого бархатного тёмно-красного соуса из долго тушёных томатов, почти без жидкости. Соус держится на мясе, не растекается вокруг. В соусе лишь микроскопическая зелёная крошка травы, без отдельных листьев. Чистые края тарелки полностью в кадре, тёплый свет.",
  42: "Крупная профессиональная фуд-фотография, вся тарелка видна целиком. На тарелке пять круглых хорошо прожаренных ГОВЯЖЬИХ ТЕФТЕЛЕЙ из фарша, поверхность цельная без надрезов, равномерно покрыта бархатистой красно-коричневой КОРОЧКОЙ от сладкой молотой паприки, обжаренной в пряном масле. Ни посыпки, ни кусочков приправ, сверху гладкая румяная мясная поверхность. Только тефтели на кремовой керамике, фон тёплый, съёмка сверху под углом.",
  43: "Красивая фотореалистичная фуд-фотография. ПЯТЬ полностью приготовленных коричневых круглых ГОВЯЖЬИХ ТЕФТЕЛЕЙ из фарша на круглой светлой тарелке, видной целиком. Сверху КАЖДУЮ тефтель покрывает только чайная ложка ОЧЕНЬ ГУСТОЙ ТЁМНО-КРАСНОЙ ТОМАТНОЙ ПАСТЫ после долгого тушения, которая держит форму и не течёт; мельчайшие зелёные вкрапления приправы внутри пасты. Тарелка чистая, без красной жидкости вокруг. Тёплый свет, ресторанная подача."
}
for key, prompt in PROMPTS.items():
  assert len(prompt) <= 500, (key, len(prompt))


def filenames(n):
  return (DEST / f"{n:04d}-revision7.webp",
          DEST / f"{n:04d}-revision7.json",
          DEST / f"{n:04d}-revision7.pending.json",
          DEST / f"{n:04d}-revision7.raw.png")


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
    parser.error("Only explicit n=32,33,42,43 allowed")
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
    "status": "revision7_unpublished", "requires_visual_qa": True,
    "generated_at": datetime.now(timezone.utc).isoformat()
  }, ensure_ascii=False, indent=2).encode())
  pending.unlink()
  raw.unlink(missing_ok=True)
  print("GENERATED", n, len(webp))


if __name__ == "__main__":
  main()
