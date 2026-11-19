#!/usr/bin/env python3
"""One final revised Alice AI ART photo for soup 10. No retries or publication."""
import hashlib, importlib.util, json, os, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"photo-library"/"soups"/"candidates"/"010"/"v3"
RESERVATION=OUT/"reserved.json"
PHOTO=OUT/"10-gribnaya-pokhlebka-perlovka-v3.webp"
META=OUT/"metadata.json"
BRANCH="photo-production/alice-art-soup-10-20261119"
PROMPT="Готовая РУССКАЯ похлёбка из сушёных БЕЛЫХ грибов с перловкой. Фотореалистичная еда: большая площадь ПРОЗРАЧНОГО тёмно-янтарного бульона, в нём МНОГО МЕЛКИХ тёмных неровных ломтиков сваренных сушёных грибов. Немного МЕЛКОЙ мягкой перловки, без кучки зёрен, мелкие кубики картофеля, лук, морковь, укроп. Нет целых грибов, шляпок пополам, шампиньонов, крупных зёрен, густой каши, сливок, сметаны. Традиционная домашняя подача в глубокой керамической тарелке, ракурс 3/4, дневной свет."
def save(msg):
    subprocess.run(["git","add","--",str(OUT.relative_to(ROOT))],check=True)
    subprocess.run(["git","commit","-m",msg],check=True)
    subprocess.run(["git","push","origin","HEAD:refs/heads/"+BRANCH],check=True)
def main():
    if RESERVATION.exists() or PHOTO.exists():
        print("SKIPPED, existing v3 candidate/reservation"); return
    assert len(PROMPT)<=500
    key,folder=os.environ.get("YANDEX_API_KEY"),os.environ.get("YANDEX_FOLDER_ID")
    if not key or not folder: raise SystemExit("Missing credentials; no paid call")
    OUT.mkdir(parents=True,exist_ok=True)
    RESERVATION.write_text(json.dumps({"recipe_number":10,"title":"Грибная похлёбка с перловкой","version":3,"prompt":PROMPT,"state":"paid_request_reserved","approval":"pending","published":False},ensure_ascii=False,indent=2),encoding="utf-8")
    save("Reserve single Alice AI ART v3 paid request for soup 10")
    spec=importlib.util.spec_from_file_location("alice_art",ROOT/"photo-pipeline"/"generate_yandexart.py")
    mod=importlib.util.module_from_spec(spec)
    sys.modules[spec.name]=mod; spec.loader.exec_module(mod)
    webp=mod.encode_webp(mod.request_image(PROMPT,key,folder))
    PHOTO.write_bytes(webp)
    META.write_text(json.dumps({"recipe_number":10,"title":"Грибная похлёбка с перловкой","version":3,"sha256":hashlib.sha256(webp).hexdigest(),"dimensions":[1200,900],"prompt":PROMPT,"approval":"pending","published":False},ensure_ascii=False,indent=2),encoding="utf-8")
    save("Save unpublished Alice AI ART soup 10 v3 candidate")
    print("CREATED soup 10 v3 pending owner approval")
if __name__=="__main__": main()
