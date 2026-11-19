#!/usr/bin/env python3
"""Create one revised unpublished Alice AI ART photograph for Russian soup #10."""
import hashlib, importlib.util, json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "photo-library" / "soups" / "candidates" / "010" / "v2"
RESERVATION = OUT / "reserved.json"
PHOTO = OUT / "10-gribnaya-pokhlebka-perlovka-v2.webp"
META = OUT / "metadata.json"
BRANCH = "photo-production/alice-art-soup-10-20261119"
PROMPT = "Русская грибная похлёбка с перловкой из сушёных белых грибов. Фотореалистичное фото готового супа: прозрачный тёмно-янтарный грибной отвар, в нём тонкие ломтики сваренных коричневых белых грибов, без целых шляпок; умеренное количество мелких мягких зёрен перловки, некрупные кусочки картофеля, обжаренные лук и морковь, мелкий укроп. Всё погружено в бульон, без горки сверху. Без шампиньонов, сливок, сметаны и сыра. Одна глубокая глиняная тарелка целиком, ракурс 3/4, дневной свет."

def save(msg):
    subprocess.run(["git","add","--",str(OUT.relative_to(ROOT))],check=True)
    subprocess.run(["git","commit","-m",msg],check=True)
    subprocess.run(["git","push","origin","HEAD:refs/heads/"+BRANCH],check=True)

def main():
    if RESERVATION.exists() or PHOTO.exists():
        print("SKIPPED: v2 exists/reserved. Do not repeat paid call.")
        return
    assert len(PROMPT)<=500, len(PROMPT)
    key,folder=os.environ.get("YANDEX_API_KEY"),os.environ.get("YANDEX_FOLDER_ID")
    if not key or not folder:
        raise SystemExit("Missing Yandex credentials. No paid call made.")
    OUT.mkdir(parents=True,exist_ok=True)
    RESERVATION.write_text(json.dumps({
        "collection":"soups","recipe_number":10,
        "title":"Грибная похлёбка с перловкой","version":2,
        "prompt":PROMPT,"state":"paid_request_reserved",
        "approval":"pending","published":False
    },ensure_ascii=False,indent=2),encoding="utf-8")
    save("Reserve one revision of Alice AI ART soup 10 candidate")
    spec=importlib.util.spec_from_file_location("alice_art", ROOT/"photo-pipeline"/"generate_yandexart.py")
    module=importlib.util.module_from_spec(spec)
    sys.modules[spec.name]=module
    spec.loader.exec_module(module)
    raw=module.request_image(PROMPT,key,folder)
    webp=module.encode_webp(raw)
    PHOTO.write_bytes(webp)
    META.write_text(json.dumps({
        "recipe_number":10,"title":"Грибная похлёбка с перловкой","version":2,
        "sha256":hashlib.sha256(webp).hexdigest(),
        "dimensions":[1200,900],"prompt":PROMPT,
        "approval":"pending","published":False
    },ensure_ascii=False,indent=2),encoding="utf-8")
    save("Save revised unpublished Alice AI ART candidate for soup 10")
    print("CREATED: soup 10 v2 pending approval")

if __name__=="__main__":
    main()
