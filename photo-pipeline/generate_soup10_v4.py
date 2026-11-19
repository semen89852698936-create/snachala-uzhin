#!/usr/bin/env python3
"""Single unpublished Alice AI ART photo candidate for soup 10 v4."""
import hashlib, importlib.util, json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "photo-library" / "soups" / "candidates" / "010" / "v4"
RESERVATION = OUT / "reserved.json"
PHOTO = OUT / "10-gribnaya-pokhlebka-perlovka-v4.webp"
META = OUT / "metadata.json"
BRANCH = "photo-production/alice-art-soup-10-20261119"
PROMPT = "Фотореалистичное фото готовой русской похлёбки из сушёных белых грибов с перловкой. В глубокой керамической тарелке 70% видимой поверхности занимает прозрачный тёмно-коричневый грибной бульон. В бульоне небольшие плоские тёмно-бурые неровные ломтики отваренных лесных белых грибов, немного мелких зёрен мягкой перловки, маленькие кусочки картофеля, мелкие морковь и лук, укроп. Всё равномерно внутри жидкости. Никакой горки крупы, целых грибных шляпок, сливок и сыра. Ракурс 3/4, мягкий свет."
def save(message):
    subprocess.run(["git","add","--",str(OUT.relative_to(ROOT))],check=True)
    subprocess.run(["git","commit","-m",message],check=True)
    subprocess.run(["git","push","origin","HEAD:refs/heads/"+BRANCH],check=True)
def main():
    if RESERVATION.exists() or PHOTO.exists():
        print("SKIPPED: v4 already reserved or saved; no duplicate paid call.")
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
    save("Reserve one Alice AI ART v4 generation for Russian soup 10")
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
    save("Save unpublished Alice AI ART candidate for soup 10 v4")
    print("CREATED soup 10 v4, approval pending")
if __name__=="__main__":
    main()
