#!/usr/bin/env python3
"""One review-only Alice AI ART 3.0 meatballs photo. No original or site edits."""
import hashlib,importlib.util,json,os,subprocess
from pathlib import Path
from datetime import datetime,timezone
from PIL import Image
ROOT=Path("photo-library/alice-art-meatballs-004-20261114")
branch="photo-production/alice-art-meatballs-004-20261114"
plan=json.loads((ROOT/"plan.json").read_text(encoding="utf8"))
assert plan["recipe_n"]==4 and plan["recipe_id"]=="meatballs"
assert plan["model"]=="aliceai-image-art-3.0" and plan["max_paid_requests"]==1
assert 1<=len(plan["prompt"])<=500 and plan["site_published"] is False
assert "панировоч" in plan["prompt"] and "ТОЛЬКО" in plan["prompt"]
recipes=json.loads(Path("_photo_source/photo-library/recipes.json").read_text(encoding="utf8"))["recipes"]
recipe=next(x for x in recipes if int(x["n"])==4)
assert recipe["id"]=="meatballs" and recipe["title"]==plan["title"]
approved=json.loads(Path("photo-library/alice-art-positive-corrections-58-68-20261114/OWNER_APPROVALS_20261114.json").read_text(encoding="utf8"))["approved"]
assert sorted(x["photo_number"] for x in approved)==[59,61,65]
for x in approved:
    assert hashlib.sha256(Path(x["path"]).read_bytes()).hexdigest()==x["sha256"]
spec=importlib.util.spec_from_file_location("alice","_photo_source/photo-pipeline/generate_yandexart.py")
alice=importlib.util.module_from_spec(spec);spec.loader.exec_module(alice)
assert alice.MODEL=="aliceai-image-art-3.0"
def git(*args):subprocess.run(["git",*args],check=True)
def save_json(path,obj):alice.atomic_write(path,(json.dumps(obj,ensure_ascii=False,indent=2)+"\n").encode("utf8"))
def push(message):
    git("add","-A",str(ROOT));git("diff","--cached","--check");git("commit","-m",message)
    git("push","origin","HEAD:refs/heads/"+branch)
git("config","user.name","github-actions[bot]")
git("config","user.email","41898282+github-actions[bot]@users.noreply.github.com")
photo=ROOT/"candidates/0004-meatballs.webp"
meta=ROOT/"records/0004-meatballs.json"
pending=ROOT/"pending/0004-meatballs.json"
rawcheck=ROOT/"raw-checkpoint/0004-meatballs.bin"
digest=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
if photo.exists() and meta.exists():
    old=json.loads(meta.read_text(encoding="utf8"))
    assert digest(photo)==old["sha256"]
    print("ALREADY_SAVED_MEATBALLS_0004",flush=True)
    raise SystemExit(0)
assert not photo.exists() and not meta.exists(),"Partial result; do not pay again"
assert not pending.exists(),"A paid request already started; do not pay again"
assert not rawcheck.exists(),"A raw paid result exists; recover rather than pay again"
assert os.environ["PHOTO_COST_APPROVED"]=="true"
assert os.environ.get("YANDEX_API_KEY") and os.environ.get("YANDEX_FOLDER_ID")
save_json(pending,{"recipe_n":4,"recipe_id":"meatballs","status":"paid_request_started_never_auto_retry","model":"aliceai-image-art-3.0","prompt":plan["prompt"],"started_at":datetime.now(timezone.utc).isoformat()})
push("Alice AI ART 3.0: reserve one paid request for meatballs 0004")
raw=alice.request_image(plan["prompt"],os.environ["YANDEX_API_KEY"],os.environ["YANDEX_FOLDER_ID"])
alice.atomic_write(rawcheck,raw)
push("Alice AI ART 3.0: save paid raw meatballs result before processing")
out=alice.encode_webp(raw)
alice.atomic_write(photo,out)
with Image.open(photo) as img:assert img.size==(1200,900)
rec={"recipe_n":4,"recipe_id":"meatballs","title":plan["title"],"model":"aliceai-image-art-3.0","prompt":plan["prompt"],"owner_constraints":plan["owner_constraints"],"source":plan["source_path"],"sha256":digest(photo),"bytes":len(out),"size":[1200,900],"status":"candidate_owner_review_required","owner_approved":False,"site_published":False,"generated_at":datetime.now(timezone.utc).isoformat()}
save_json(meta,rec)
rawcheck.unlink();pending.unlink()
push("Alice AI ART 3.0: save 0004 tomato meatballs photo for owner review only")
print("SAVED_NEW_MEATBALLS_0004",rec["sha256"],flush=True)
