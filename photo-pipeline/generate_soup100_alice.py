#!/usr/bin/env python3
"""One Alice AI ART 3.0 unpublished candidate for Cantonese watercress soup #100."""
import hashlib, importlib.util, json, os, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"photo-library/soups/candidates/100/alice-v1"
RESERVATION=OUT/"reserved.json"
PHOTO=OUT/"100-watercress-pork-ribs-alice-v1.webp"
META=OUT/"metadata.json"
BRANCH="photo-production/alice-art-soup-100-20261121"
TITLE="Суп с водяным крессом и свиными рёбрами"
PROMPT="Кантонский суп с водяным крессом и свиными рёбрами. Фотореалистичная фуд-фотография: прозрачный светло-янтарный бульон, 4–5 кусочков полностью сваренных свиных рёбрышек с косточками, длинные мягкие тёмно-зелёные листья и стебли настоящего водяного кресса после варки, 2–3 варёных красных финика ююба. Одна керамическая суповая тарелка целиком, ракурс 3/4, мягкий тёплый свет. Без шпината, пюре, лапши, картофеля, сливок, сырых овощей, декора, надписей и коллажа."
def git_checkpoint(msg):
 subprocess.run(["git","add","--",str(OUT.relative_to(ROOT))],check=True)
 subprocess.run(["git","commit","-m",msg],check=True)
 subprocess.run(["git","push","origin","HEAD:refs/heads/"+BRANCH],check=True)
def main():
 if RESERVATION.exists() or PHOTO.exists() or META.exists():
  print("NO_RETRY: existing paid reservation or photo");return
 assert len(PROMPT)<=500, len(PROMPT)
 key,folder=os.environ.get("YANDEX_API_KEY"),os.environ.get("YANDEX_FOLDER_ID")
 if not key or not folder or os.environ.get("PHOTO_COST_APPROVED")!="true":
  raise SystemExit("Credentials or cost permission missing; no paid call")
 OUT.mkdir(parents=True,exist_ok=True)
 RESERVATION.write_text(json.dumps({"recipe_number":100,"title":TITLE,"model":"aliceai-image-art-3.0","prompt":PROMPT,"state":"paid_request_reserved_no_auto_retry","approval":"pending","published":False,"timestamp":datetime.now(timezone.utc).isoformat()},ensure_ascii=False,indent=2),encoding="utf-8")
 git_checkpoint("Alice AI ART soup 100: reserve one paid request before generation")
 spec=importlib.util.spec_from_file_location("alice_yandex_adapter",ROOT/"_alice_source/photo-pipeline/generate_yandexart.py")
 mod=importlib.util.module_from_spec(spec);sys.modules[spec.name]=mod;spec.loader.exec_module(mod)
 webp=mod.encode_webp(mod.request_image(PROMPT,key,folder))
 PHOTO.write_bytes(webp)
 META.write_text(json.dumps({"recipe_number":100,"title":TITLE,"photo_path":str(PHOTO.relative_to(ROOT)),"model":"aliceai-image-art-3.0","sha256":hashlib.sha256(webp).hexdigest(),"bytes":len(webp),"size":[1200,900],"prompt":PROMPT,"approval":"pending","published":False},ensure_ascii=False,indent=2),encoding="utf-8")
 git_checkpoint("Alice AI ART soup 100: save unpublished WebP for owner approval")
 print("ALICE_SOUP_100_CANDIDATE_SAVED")
if __name__=="__main__":main()
