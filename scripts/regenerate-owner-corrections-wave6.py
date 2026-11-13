#!/usr/bin/env python3
"""Six individually bounded paid Alice AI ART corrections; never update live site."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "photo-library/regeneration-owner-meat-64-20261113/revision6"

PROMPTS = {
  30: "Ресторанная фуд-фотография сверху под углом: большая светлая керамическая тарелка ПОЛНОСТЬЮ видна в кадре. В центре три толстых ломтя запечённой свиной вырезки с румяной корочкой и полностью готовой светлой серединой. СПРАВА ОТ МЯСА отдельная маленькая горстка мелко порезанных обжаренных коричневых шампиньонов с тонкими крошками зелёной пряной травы. Чистая тарелка, без другой еды, без жидкости, спокойный тёплый свет.",
  32: "Готовая запечённая СВИНАЯ ВЫРЕЗКА на полностью видимой светлой керамической тарелке, три мясных ломтя с РОВНОЙ ЗОЛОТИСТО-КРАСНОЙ КОРОЧКОЙ от мелкой молотой сладкой паприки. Светлая полностью приготовленная нежная мякоть. Красноватая паприка и чесночное масло полностью впитаны в корочку, поверхность гладкая, без кусочков приправы. Только три ломтя свинины и немного собственного сока на тарелке, никаких других ингредиентов. Аппетитная реалистичная ресторанная съёмка сверху под углом.",
  33: "Ресторанная фуд-фотография на широком плане. Белая круглая керамическая тарелка целиком видна с ободком по кругу. Посередине три толстых румяных ломтя готовой запечённой свиной вырезки. ПОВЕРХ свинины густой ТОМАТНЫЙ СОУС-ПЮРЕ после долгого тушения, полностью однородная бархатистая тёмно-красная масса, мелкие зелёные крупинки приправы в соусе. Только соус и свинина, гладкая поверхность блюда, нет отдельных нарезанных овощей или крупных листьев. Тёплый свет.",
  39: "Красивая натуральная фуд-фотография: на большой полностью видимой светлой тарелке ровно пять КРУГЛЫХ ГОВЯЖЬИХ ТЕФТЕЛЕЙ из фарша. Каждая тефтеля полностью приготовлена, поверхность коричневая с мелкими румяными участками, круглые рельефные бока, никакой светлой начинки на поверхности. Очень лёгкий прозрачный блеск мясного сока и мелкие зелёные крапинки пряной травы. Только тефтели, без соуса, гарнира и дополнительных предметов. Вид под углом, тёплый свет.",
  42: "Качественная фотореалистичная фотография еды. Пять полностью обжаренных круглых ГОВЯЖЬИХ ТЕФТЕЛЕЙ из фарша с красновато-коричневой сухой ароматной корочкой от перемолотой паприки и чесночной приправы. Приправы впитаны в мясо и не имеют видимых отдельных кусочков. Тарелка керамическая светлая с широким видимым ободком, целиком помещается в кадре; на ней только пять тефтелей. Мягкое тёплое освещение, съёмка сверху под углом, аппетитный вид.",
  43: "Высококачественная ресторанная фотография блюда: ПЯТЬ круглых готовых говяжьих тефтелей из фарша с румяной корочкой, покрытых СВЕРХУ однородной густой томатной подливой-пюре тёмно-красного цвета после долгого тушения, с мельчайшими вкраплениями зелёной пряной зелени. Соус мягкий и гладкий, не салат, не свежие овощи. Белая широкая тарелка видна целиком с ободком, тефтели в центре. Никакой другой еды, красивый тёплый мягкий свет."
}
for key, prompt in PROMPTS.items():
  assert len(prompt) <= 500, (key, len(prompt))


def filenames(n):
  return (DEST / f"{n:04d}-revision6.webp",
          DEST / f"{n:04d}-revision6.json",
          DEST / f"{n:04d}-revision6.pending.json",
          DEST / f"{n:04d}-revision6.raw.png")


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
    print("VALIDATED: exactly six corrected finished-plating prompts, n=24,33")
    return
  if args.n not in PROMPTS:
    parser.error("Only explicit n=30,32,33,39,42,43 allowed")
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
    "status": "revision6_unpublished", "requires_visual_qa": True,
    "generated_at": datetime.now(timezone.utc).isoformat()
  }, ensure_ascii=False, indent=2).encode())
  pending.unlink()
  raw.unlink(missing_ok=True)
  print("GENERATED", n, len(webp))


if __name__ == "__main__":
  main()
