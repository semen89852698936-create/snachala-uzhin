#!/usr/bin/env python3
"""One authorized, unpublished Alice AI ART 3.0 candidate for Thai salad #90."""
from __future__ import annotations
import argparse, hashlib, io, json, os, runpy, subprocess
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/"photo-library"/"salads"/"thai-90-20261119"
WEBP=WORK/"90_world-salad-09-10-candidate-v3.webp"
RECORD=WORK/"90_world-salad-09-10-candidate-v3.json"
PENDING=WORK/"90_world-salad-09-10.pending.json"
BRANCH="photo-production/alice-thai-salad-90-20261119"
PROMPT="Фотореалистичная фотография тайского рисового салата КХАО ЯМ. Белый рассыпчатый жасминовый рис холмиком на широкой светлой тарелке. Вокруг отдельными секторами: длинная зелёная фасоль МЕЛКО НАРЕЗАНА ПОПЕРЁК кусочками 1 см, тонкая соломка огурца, белые проростки фасоли, разделённая на волокна мякоть помело, СОВСЕМ МЕЛКО РУБЛЕНЫЕ лемонграсс и листья каффир-лайма. Сверху риса золотистая жареная кокосовая стружка. Отдельная пиала коричневого соуса буду. НЕТ целых стручков, долек лайма, яиц и мяса."

def save(path, blob):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_name(path.name+".tmp")
    temp.write_bytes(blob)
    temp.replace(path)

def checkpoint(message):
    subprocess.run(["git","add","-A",str(WORK.relative_to(ROOT))],cwd=ROOT,check=True)
    check=subprocess.run(["git","diff","--cached","--quiet"],cwd=ROOT)
    if check.returncode:
        subprocess.run(["git","-c","user.name=github-actions[bot]","-c","user.email=41898282+github-actions[bot]@users.noreply.github.com","commit","-m",message],cwd=ROOT,check=True)
        subprocess.run(["git","push","origin","HEAD:refs/heads/"+BRANCH],cwd=ROOT,check=True)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--execute",action="store_true")
    args=ap.parse_args()
    assert len(PROMPT)<=500, f"Prompt too long: {len(PROMPT)}"
    assert "жасминовый рис" in PROMPT and "соуса буду" in PROMPT
    if RECORD.exists():
        assert WEBP.exists(),"Record exists without photo"
        entry=json.loads(RECORD.read_text(encoding="utf-8"))
        assert hashlib.sha256(WEBP.read_bytes()).hexdigest()==entry["sha256"]
        print("ALREADY_GENERATED, no repeat call")
        return
    assert not WEBP.exists(),"Image exists without record"
    assert not PENDING.exists(),"Uncertain paid request; never retry"
    if not args.execute:
        print(json.dumps({"recipe_number":90,"title":"Кхао ям с рисом и травами","chars":len(PROMPT),"prompt":PROMPT,"paid_api_calls":0},ensure_ascii=False))
        return
    assert os.getenv("PHOTO_COST_APPROVED")=="true"
    key=os.environ["YANDEX_API_KEY"]
    folder=os.environ.get("YANDEX_FOLDER_ID","b1g00u8p0k5nl98v8nre")
    save(PENDING,json.dumps({"recipe_number":90,"status":"request_pending_or_sent","at":datetime.now(timezone.utc).isoformat()},ensure_ascii=False).encode())
    checkpoint("Reserve single Alice AI ART Thai salad 90 paid request")
    api=runpy.run_path(str(ROOT/"_photo_source"/"photo-pipeline"/"generate_yandexart.py"))
    raw=api["request_image"](PROMPT,key,folder)
    with Image.open(io.BytesIO(raw)) as src:
        src.load()
        assert src.width>=900 and src.height>=700
        image=ImageOps.exif_transpose(src).convert("RGB")
        image=ImageOps.fit(image,(1536,1024),method=Image.Resampling.LANCZOS)
        dest=io.BytesIO()
        image.save(dest,format="WEBP",quality=90,method=6)
    blob=dest.getvalue()
    assert len(blob)>100000 and blob[:4]==b"RIFF" and blob[8:12]==b"WEBP"
    save(WEBP,blob)
    entry={"recipe_number":90,"recipe_id":"world-salad-09-10","title":"Кхао ям с рисом и травами","generator":"aliceai-image-art-3.0","prompt":PROMPT,"photo":str(WEBP.relative_to(ROOT)),"sha256":hashlib.sha256(blob).hexdigest(),"bytes":len(blob),"width":1536,"height":1024,"status":"generated_candidate_pending_user_approval","published":False}
    save(RECORD,(json.dumps(entry,ensure_ascii=False,indent=2)+"\n").encode())
    PENDING.unlink()
    checkpoint("Checkpoint one unpublished Alice AI ART Thai salad 90 photo")
    print("PHOTO_READY "+str(WEBP.relative_to(ROOT)))

if __name__=="__main__":
    main()
