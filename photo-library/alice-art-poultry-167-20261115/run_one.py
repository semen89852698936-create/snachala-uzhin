#!/usr/bin/env python3
"""Make exactly one candidate image for poultry #167 using Alice AI ART 3.0.
Site and approved photographs are NEVER modified.
"""
import hashlib,importlib.util,json,os,subprocess
from pathlib import Path
from datetime import datetime,timezone
from PIL import Image
ROOT=Path("photo-library/alice-art-poultry-167-20261115")
branch="photo-production/alice-art-poultry-167-review-20261115"
plan=json.loads((ROOT/"plan.json").read_text(encoding="utf8"))
assert (plan["recipe_n"],plan["recipe_id"],plan["model"])==(167,"collection-poultry-06-01","aliceai-image-art-3.0")
assert not plan["site_publish"] and plan["max_paid_requests"]==1
assert 1<=len(plan["prompt"])<=500
assert Path(plan["source_photo"]).exists()
rec=json.loads(Path("_photo_source/photo-library/recipes.json").read_text(encoding="utf8"))["recipes"]
r=next(x for x in rec if int(x["n"])==167)
assert r["id"]==plan["recipe_id"] and r["title"]==plan["title"]
spec=importlib.util.spec_from_file_location("alice","_photo_source/photo-pipeline/generate_yandexart.py")
alice=importlib.util.module_from_spec(spec);spec.loader.exec_module(alice)
assert alice.MODEL=="aliceai-image-art-3.0"
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def save(path,obj):alice.atomic_write(path,(json.dumps(obj,ensure_ascii=False,indent=2)+"\n").encode("utf8"))
def git(*args):subprocess.run(["git",*args],check=True)
def push(msg):
    git("add","-A",str(ROOT));git("diff","--cached","--check")
    git("commit","-m",msg);git("push","origin","HEAD:refs/heads/"+branch)
out=ROOT/"candidates/0167-collection-poultry-06-01.webp"
record=ROOT/"records/0167-collection-poultry-06-01.json"
pending=ROOT/"pending/0167-collection-poultry-06-01.json"
raw=ROOT/"raw-checkpoint/0167-collection-poultry-06-01.bin"
git("config","user.name","github-actions[bot]")
git("config","user.email","41898282+github-actions[bot]@users.noreply.github.com")
if out.exists() and record.exists():
    prev=json.loads(record.read_text(encoding="utf8"))
    assert prev["sha256"]==sha(out)
    print("EXISTING_VALID_CANDIDATE_167",flush=True)
    raise SystemExit(0)
assert not any(p.exists() for p in [out,record,pending,raw]),"Paid request may already exist, no duplicate request"
assert os.environ.get("PHOTO_COST_APPROVED")=="true"
assert os.environ.get("YANDEX_API_KEY") and os.environ.get("YANDEX_FOLDER_ID")
save(pending,{"photo_number":167,"model":plan["model"],"prompt":plan["prompt"],
              "status":"paid_request_started_never_auto_retry",
              "at":datetime.now(timezone.utc).isoformat()})
push("Alice AI ART 3.0: reserve poultry meatballs #167 paid request")
raw_bytes=alice.request_image(plan["prompt"],os.environ["YANDEX_API_KEY"],os.environ["YANDEX_FOLDER_ID"])
alice.atomic_write(raw,raw_bytes)
push("Alice AI ART 3.0: checkpoint paid poultry #167 raw image")
webp=alice.encode_webp(raw_bytes)
alice.atomic_write(out,webp)
with Image.open(out) as img:assert img.size==(1200,900)
meta={"photo_number":167,"recipe_id":plan["recipe_id"],"model":plan["model"],"prompt":plan["prompt"],
      "source":plan["source_photo"],"sha256":sha(out),"bytes":len(webp),"size":[1200,900],
      "status":"candidate_owner_review_required","site_published":False,
      "generated_at":datetime.now(timezone.utc).isoformat()}
save(record,meta)
pending.unlink();raw.unlink()
push("Alice AI ART 3.0: save corrected chicken meatballs #167 for owner review only")
print("POULTRY_167_READY",meta["sha256"],flush=True)
