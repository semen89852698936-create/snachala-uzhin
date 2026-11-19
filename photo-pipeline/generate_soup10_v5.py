#!/usr/bin/env python3
"""Single unpublished Alice AI ART photo candidate for soup 10 v5."""
import hashlib, importlib.util, json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "photo-library" / "soups" / "candidates" / "010" / "v5"
RESERVATION = OUT / "reserved.json"
PHOTO = OUT / "10-gribnaya-pokhlebka-perlovka-v5.webp"
META = OUT / "metadata.json"
BRANCH = "photo-production/alice-art-soup-10-20261119"
PROMPT = "Фотореалистичное фото: большая миска РУССКОГО СУПА из сушёных белых грибов и перловки. Ракурс сверху 45 градусов, тарелка целиком. Большая часть тарелки заполнена прозрачным тёмно-янтарным грибным БУЛЬОНОМ. В нём разрозненно плавают мелко нарезанные тёмно-коричневые мягкие варёные белые грибы, несколько мелких зёрен перловки, кубики картофеля и моркови, лук и укроп. Нет горки в центре, больших шляпок, половинок грибов, густой каши, сметаны. Дневной свет, ресторанная съёмка готового блюда."
def save(message):
    subprocess.run(["git","add","--",str(OUT.relative_to(ROOT))],check=True)
    subprocess.run(["git","commit","-m",message],check=True)
    subprocess.run(["git","push","origin","HEAD:refs/heads/"+BRANCH],check=True)
def main():
    if RESERVATION.exists() or PHOTO.exists():
        print("SKIPPED: v5 already reserved or saved; no duplicate paid call.")
        return
    assert len(PROMPT)<=500
    key, folder = os.environ.get("YANDEX_API_KEY"), os.environ.get("YANDEX_FOLDER_ID")
    if not key or not folder:
        raise SystemExit("Missing Yandex credentials; no paid call.")
    OUT.mkdir(parents=True,exist_ok=True)
    RESERVATION.write_text(json.dumps({
        "recipe_number":10,"title":"Грибная похлёбка с перловкой",
        "version":4,"prompt":PROMPT,
        "state":"paid_request_reserved","approval":"pending","published":False
    },ensure_ascii=False,indent=2),encoding="utf-8")
    save("Reserve one Alice AI ART v5 generation for Russian soup 10")
    spec=importlib.util.spec_from_file_location("alice_art",ROOT/"photo-pipeline"/"generate_yandexart.py")
    mod=importlib.util.module_from_spec(spec)
    sys.modules[spec.name]=mod
    spec.loader.exec_module(mod)
    webp=mod.encode_webp(mod.request_image(PROMPT,key,folder))
    PHOTO.write_bytes(webp)
    META.write_text(json.dumps({
        "recipe_number":10,"title":"Грибная похлёбка с перловкой","version":4,
        "sha256":hashlib.sha256(webp).hexdigest(),"dimensions":[1200,900],
        "prompt":PROMPT,"approval":"pending","published":False
    },ensure_ascii=False,indent=2),encoding="utf-8")
    save("Save unpublished Alice AI ART candidate for soup 10 v5")
    print("CREATED soup 10 v5, approval pending")
if __name__=="__main__":
    main()
