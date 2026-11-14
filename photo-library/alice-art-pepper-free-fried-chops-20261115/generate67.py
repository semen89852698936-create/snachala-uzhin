#!/usr/bin/env python3
"""Exactly one optional paid Alice AI ART 3.0 candidate for prepared boneless pork 67."""
import hashlib,importlib.util,json,os,subprocess
from pathlib import Path
from datetime import datetime,timezone
from PIL import Image
ROOT=Path("photo-library/alice-art-pepper-free-fried-chops-20261115")
BASE=ROOT/"new67"
plan=json.loads((BASE/"plan.json").read_text(encoding="utf8"))
assert plan["model"]=="aliceai-image-art-3.0"
assert plan["recipe_n"]==110 and plan["recipe_id"]=="collection-meat-10-02"
assert plan["max_paid_requests"]==1 and plan["site_published"] is False
assert 1<=len(plan["prompt"])<=500
assert Path(plan["source"]).is_file()
approved=json.loads(Path("photo-library/alice-art-positive-corrections-58-68-20261114/OWNER_APPROVALS_20261114.json").read_text(encoding="utf8"))["approved"]
assert sorted(a["photo_number"] for a in approved)==[59,61,65]
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
for a in approved:assert sha(a["path"])==a["sha256"]
recipes=json.loads(Path("_photo_source/photo-library/recipes.json").read_text(encoding="utf8"))["recipes"]
recipe=next(x for x in recipes if int(x["n"])==110)
assert recipe["id"]==plan["recipe_id"] and recipe["title"]==plan["title"]
spec=importlib.util.spec_from_file_location("alice","_photo_source/photo-pipeline/generate_yandexart.py")
alice=importlib.util.module_from_spec(spec);spec.loader.exec_module(alice)
assert alice.MODEL=="aliceai-image-art-3.0"
out=BASE/"candidates/0067-collection-meat-10-02.webp"
rec=BASE/"records/0067-collection-meat-10-02.json"
marker=BASE/"pending/0067-collection-meat-10-02.json"
raw=BASE/"raw-checkpoint/0067-collection-meat-10-02.bin"
def git(*args):subprocess.run(["git",*args],check=True)
def save(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
def push(msg):
    git("add","-A",str(BASE))
    git("diff","--cached","--check")
    git("commit","-m",msg)
    git("push","origin","HEAD:refs/heads/photo-production/alice-art-pepper-free-fried-chops-20261115")
git("config","user.name","github-actions[bot]")
git("config","user.email","41898282+github-actions[bot]@users.noreply.github.com")
if out.exists() and rec.exists():
    data=json.loads(rec.read_text(encoding="utf8"))
    assert sha(out)==data["sha256"]
    print("ALREADY_SAVED_67_NEW",flush=True)
    raise SystemExit(0)
assert not (out.exists() or rec.exists() or marker.exists() or raw.exists()),"Pending or partial paid call: never repeat automatically"
assert os.environ["PHOTO_COST_APPROVED"]=="true"
assert os.environ.get("YANDEX_API_KEY") and os.environ.get("YANDEX_FOLDER_ID")
save(marker,{"status":"paid_request_started_never_auto_retry","photo_number":67,"model":plan["model"],"prompt":plan["prompt"],"started_at":datetime.now(timezone.utc).isoformat()})
push("Alice AI ART 3.0: reserve one paid 67 image request")
payload=alice.request_image(plan["prompt"],os.environ["YANDEX_API_KEY"],os.environ["YANDEX_FOLDER_ID"])
alice.atomic_write(raw,payload)
push("Alice AI ART 3.0: checkpoint raw paid 67 image")
webp=alice.encode_webp(payload)
alice.atomic_write(out,webp)
with Image.open(out) as im:assert im.size==(1200,900)
info={"photo_number":67,"recipe_n":110,"recipe_id":plan["recipe_id"],"model":plan["model"],
      "prompt":plan["prompt"],"sha256":sha(out),"bytes":len(webp),"size":[1200,900],
      "status":"candidate_owner_review_required","site_published":False,
      "generated_at":datetime.now(timezone.utc).isoformat()}
save(rec,info)
marker.unlink();raw.unlink()
push("Alice AI ART 3.0: save boneless fried irregular 67 candidate for owner approval")
print("NEW_COOKED_PORK_67_SAVED",info["sha256"],flush=True)
