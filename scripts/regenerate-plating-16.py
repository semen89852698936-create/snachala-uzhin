#!/usr/bin/env python3
"""Targeted Yandex AI regeneration of 6 meat photographs and 10 frittatas."""
import hashlib, importlib.util, json, os, argparse
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"_photo_source"
spec=importlib.util.spec_from_file_location("ym",SOURCE/"photo-pipeline/generate_yandexart.py")
ym=importlib.util.module_from_spec(spec);spec.loader.exec_module(ym)
recipes={r["n"]:r for r in ym.load_recipes(SOURCE/"photo-library/recipes.json")}
PHOTO_MAP=ROOT/"photo-library"/"ai-recipe-photo-map.json"
photo_map=json.loads(PHOTO_MAP.read_text())
assert photo_map.get("total")==1001 and len(photo_map.get("photos",[]))==1001
photo_entries={int(p["n"]):p for p in photo_map["photos"]}
assert len(photo_entries)==1001 and set(photo_entries)==set(range(1,1002))
rules={
27:"Говяжьи медальоны отдельно. Рядом ГОРКА МЕЛКО ИЗМЕЛЬЧЕННОГО обжаренного яблока с шалфеем. Никаких яблочных долек сверху или рядом.",
28:"Говяжьи медальоны отдельно. МЕЛКО НАРЕЗАННЫЙ тушёный чернослив с тмином в соусе рядом с мясом. Без целого чернослива поверх медальонов.",
32:"Запечённая свиная вырезка, паприка, чеснок в маринаде. БЕЗ целых зубчиков чеснока сверху и рядом.",
37:"Запечённая свиная вырезка, обжаренные ДОЛЬКИ яблока с шалфеем отдельным гарниром РЯДОМ, НЕ поверх мяса.",
117:"Румяные свиные отбивные, рядом мелко нарезанное обжаренное яблоко с шалфеем небольшой горкой. НИКАКИХ долек яблока.",
118:"Свиные отбивные с тмином, МЕЛКО НАРЕЗАННЫЙ чернослив в соусе рядом, ни одного целого чернослива на мясе."
}
queue=list(rules)+list(range(921,931))
def prompt(n):
 r=recipes[n]
 if n in rules: desc=rules[n]
 else: desc=f'Итальянская фриттата «{r["title"]}». ЦЕЛЬНЫЙ запечённый омлет со смешанной начинкой: {", ".join(r["ingredients"][:6])}. НЕТ глазуньи, яиц-пашот, отдельных желтков, жареных яиц сверху.'
 return ("Фотореалистичная ресторанная фуд-фотография. "+desc+
         " Тёплый кинематографический свет, керамическая тарелка, крупный план, без людей и текста.")[:500]
parser=argparse.ArgumentParser()
parser.add_argument("--dry-run",action="store_true")
parser.add_argument("--limit",type=int,default=16)
args=parser.parse_args()
assert len(queue)==16
assert 1<=args.limit<=16
made=0
for n in queue:
 r=recipes[n]; assert (("фриттат" in r["title"].lower()) if n>900 else True)
 p=prompt(n)
 print(f"PROMPT {n}: {r['title']}: {p}",flush=True)
 entry=photo_entries[n]
 image=ROOT/entry["path"].lstrip("/")
 assert image.is_file(),f"Missing mapped live asset {image}"
 candidate_dir=ROOT/"photo-library"/"regeneration-20261103"/"candidates"
 candidate=candidate_dir/f"{n:04d}-{r['id']}.webp"
 record=candidate_dir/f"{n:04d}.candidate.json"
 pending=candidate_dir/f"{n:04d}.candidate.pending.json"
 checkpoint=candidate_dir/f"{n:04d}.candidate.raw.png"
 if args.dry_run:
  print(f"DRY-RUN {n}: mapped source={entry['path']} candidate={candidate.relative_to(ROOT)}",flush=True)
  continue
 if record.exists():
  x=json.loads(record.read_text())
  assert candidate.is_file() and hashlib.sha256(candidate.read_bytes()).hexdigest()==x["candidate_sha256"]
  print(f"SKIP VERIFIED CANDIDATE {n}",flush=True)
  continue
 if made>=args.limit:
  break
 if pending.exists():
  if checkpoint.exists():
   print(f"RECOVER PAID RAW {n}",flush=True)
   raw=checkpoint.read_bytes()
   webp=ym.encode_webp(raw)
   candidate_dir.mkdir(parents=True,exist_ok=True)
   ym.atomic_write(candidate,webp)
   newhash=hashlib.sha256(webp).hexdigest()
   ym.atomic_write(record,json.dumps({"n":n,"title":r["title"],"id":r["id"],"prompt":p,
     "source_path":entry["path"],"source_git_blob_sha":entry["sha"],
     "candidate_path":"/"+str(candidate.relative_to(ROOT)).replace("\\\\","/"),
     "candidate_sha256":newhash,"visually_verified":False,
     "generated_at":datetime.now(timezone.utc).isoformat()},ensure_ascii=False,indent=2).encode())
   pending.unlink()
   checkpoint.unlink()
   made+=1
   continue
  print(f"SKIP UNRESOLVED PAID REQUEST {n}",flush=True)
  continue
 key=os.environ["YANDEX_API_KEY"]; folder=os.environ["YANDEX_FOLDER_ID"]
 assert os.environ.get("PHOTO_COST_APPROVED")=="true"
 candidate_dir.mkdir(parents=True,exist_ok=True)
 ym.atomic_write(pending,json.dumps({"n":n,"prompt":p,"status":"request_pending_or_sent",
   "source_path":entry["path"],"source_git_blob_sha":entry["sha"]},ensure_ascii=False).encode())
 raw=ym.request_image(p,key,folder)
 ym.atomic_write(checkpoint,raw)
 webp=ym.encode_webp(raw)
 ym.atomic_write(candidate,webp)
 newhash=hashlib.sha256(webp).hexdigest()
 ym.atomic_write(record,json.dumps({"n":n,"title":r["title"],"id":r["id"],
   "prompt":p,"source_path":entry["path"],"source_git_blob_sha":entry["sha"],
   "candidate_path":"/"+str(candidate.relative_to(ROOT)).replace("\\\\","/"),
   "candidate_sha256":newhash,"visually_verified":False,
   "generated_at":datetime.now(timezone.utc).isoformat()},ensure_ascii=False,indent=2).encode())
 pending.unlink()
 checkpoint.unlink()
 made+=1
 print(f"GENERATED CANDIDATE {n} sha256={newhash}",flush=True)
