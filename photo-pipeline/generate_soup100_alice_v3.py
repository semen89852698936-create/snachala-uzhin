#!/usr/bin/env python3
"""One corrected Alice AI ART 3.0 soup #100 v3 candidate, no automatic paid retry."""
import hashlib, importlib.util, json, os, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"photo-library/soups/candidates/100/alice-v3"
RESERVATION=OUT/"reserved.json"
PHOTO=OUT/"100-watercress-pork-ribs-alice-v3.webp"
META=OUT/"metadata.json"
BRANCH="photo-production/alice-art-soup-100-v3-20261121"
TITLE="Суп с водяным крессом и свиными рёбрами"
PROMPT="Кантонский суп с водяным крессом (Nasturtium officinale), свиными рёбрами и ююбой. Реалистичная фотография ГОТОВОГО супа после 25 минут варки. Зелень разваренная: много очень мелких округлых листочков, тонкие ветвящиеся стебли, мягкие сморщенные тёмно-оливковые пучки, частично погружённые в прозрачный янтарный бульон. 4 сваренных свиных ребра с косточками, 2 варёных красных ююба. Одна тарелка ЦЕЛИКОМ с широкими полями кадра, ракурс 3/4. Без шпината, бок-чоя, крупных свежих листьев, надписей."
def checkpoint(msg):
 subprocess.run(["git","add","--",str(OUT.relative_to(ROOT))],check=True)
 subprocess.run(["git","commit","-m",msg],check=True)
 subprocess.run(["git","push","origin","HEAD:refs/heads/"+BRANCH],check=True)
def main():
 if RESERVATION.exists() or PHOTO.exists() or META.exists():
  print("NO_RETRY: reservation or photo exists");return
 assert len(PROMPT)<=500,len(PROMPT)
 key,folder=os.environ.get("YANDEX_API_KEY"),os.environ.get("YANDEX_FOLDER_ID")
 if not key or not folder or os.environ.get("PHOTO_COST_APPROVED")!="true":
  raise SystemExit("Credentials or paid approval missing: no API request")
 OUT.mkdir(parents=True,exist_ok=True)
 RESERVATION.write_text(json.dumps({
 "recipe_number":100,"version":3,"title":TITLE,"model":"aliceai-image-art-3.0",
 "prompt":PROMPT,"state":"paid_request_reserved_no_auto_retry",
 "approval":"pending","published":False,"timestamp":datetime.now(timezone.utc).isoformat()
 },ensure_ascii=False,indent=2),encoding="utf-8")
 checkpoint("Alice AI ART soup 100 v3: reserve one paid request")
 spec=importlib.util.spec_from_file_location("alice_adapter",ROOT/"_alice_source/photo-pipeline/generate_yandexart.py")
 adapter=importlib.util.module_from_spec(spec);sys.modules[spec.name]=adapter;spec.loader.exec_module(adapter)
 webp=adapter.encode_webp(adapter.request_image(PROMPT,key,folder))
 PHOTO.write_bytes(webp)
 META.write_text(json.dumps({
 "recipe_number":100,"version":3,"title":TITLE,"model":"aliceai-image-art-3.0",
 "photo_path":str(PHOTO.relative_to(ROOT)),
 "sha256":hashlib.sha256(webp).hexdigest(),"bytes":len(webp),"size":[1200,900],
 "prompt":PROMPT,"approval":"pending","published":False
 },ensure_ascii=False,indent=2),encoding="utf-8")
 checkpoint("Alice AI ART soup 100 v3: save separate unpublished WebP for review")
 print("ALICE_SOUP_100_V3_CANDIDATE_SAVED")
if __name__=="__main__":main()
