#!/usr/bin/env python3
"""Run exact source-preserving sauce retouch for 63 and Alice AI ART 3.0 for 66/67.
No recipe catalog or approved photo is ever modified. Never auto-repeat paid calls.
"""
import hashlib
import importlib.util
import io
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT=Path("photo-library/alice-art-rework-63-66-67-20261114")
plan=json.loads((ROOT/"plan.json").read_text(encoding="utf-8"))
APPROVALS=Path(plan["owner_approval_file"])
assert plan["model"]=="aliceai-image-art-3.0"
assert plan["publish_to_site"] is False
approved=json.loads(APPROVALS.read_text(encoding="utf8"))["approved"]
assert sorted(x["photo_number"] for x in approved)==[59,61,65]
def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
for a in approved:
    assert Path(a["path"]).is_file()
    assert sha(a["path"])==a["sha256"], f"Owner-approved image changed: {a['photo_number']}"

def run_git(*args):
    subprocess.run(["git",*args],check=True)
def save_json(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_name(path.name+".tmp")
    temp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    temp.replace(path)
def commit_and_push(message):
    run_git("add","-A",str(ROOT))
    run_git("diff","--cached","--check")
    status=subprocess.run(["git","diff","--cached","--quiet"])
    if status.returncode != 0:
        run_git("commit","-m",message)
        run_git("push","origin","HEAD:refs/heads/photo-production/alice-art-rework-63-66-67-20261114")
run_git("config","user.name","github-actions[bot]")
run_git("config","user.email","41898282+github-actions[bot]@users.noreply.github.com")

# 63 is NOT a Yandex API regeneration. Editing only the pea pixels preserves the
# already-user-reviewed beef, sauce shape, plate and entire scene exactly.
s=plan["photo63"]
p63=ROOT/"candidates"/"0063-collection-meat-09-08.webp"
meta63=ROOT/"records"/"0063-collection-meat-09-08.json"
maskpng=ROOT/"qa-mask-63.png"
source63=Path(s["source"])
assert source63.is_file()
if p63.exists() and meta63.exists():
    old=json.loads(meta63.read_text(encoding="utf8"))
    assert old["sha256"]==sha(p63)
else:
    assert not p63.exists() and not meta63.exists(), "63 partial result"
    original=np.asarray(Image.open(source63).convert("RGB")).copy()
    assert original.shape==(900,1200,3)
    hsv=cv2.cvtColor(original,cv2.COLOR_RGB2HSV)
    roi=np.zeros((900,1200),dtype=np.uint8)
    polygon=np.array([[122,455],[190,404],[424,402],[566,453],[637,551],
                      [648,683],[560,748],[287,757],[113,663]],np.int32)
    cv2.fillPoly(roi,[polygon],255)

    # Detect chromatic GREEN peas in the creamy sauce, not the beige sauce itself.
    color=cv2.inRange(hsv,(30,65,35),(95,255,255))
    color=cv2.bitwise_and(color,roi)
    # Remove isolated camera/noise dots and retain pea bodies; each pea is a solid colored circle.
    clean=cv2.morphologyEx(color,cv2.MORPH_OPEN,
                           cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
    count,cc,stats,centers=cv2.connectedComponentsWithStats(clean,8)
    pea_mask=np.zeros((900,1200),np.uint8)
    accepted=[]
    for i in range(1,count):
        x,y,w,h,area=map(int,stats[i])
        if area>=42 and w<=85 and h<=85 and 2<=w/h<=3: # overwritten below for round
            pass
        if area>=42 and 6<=w<=85 and 6<=h<=85:
            # Peas: round blobs of color, unlike many thin herb strands.
            ratio=w/h
            if .4 <= ratio <= 2.4:
                pea_mask[cc==i]=255
                accepted.append({"x":x,"y":y,"w":w,"h":h,"area":area})
    if len(accepted)<5:
        raise RuntimeError("Pea mask too sparse: requires manual review; no other pixels edited")
    mask=cv2.dilate(pea_mask,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(15,15)))
    mask=cv2.bitwise_and(mask,roi)
    # cv2.inpaint leaves all pixels outside mask unchanged.
    edited=cv2.inpaint(original,mask,7,cv2.INPAINT_TELEA)
    assert np.array_equal(original[mask==0],edited[mask==0]), "Outside-mask pixels changed"
    p63.parent.mkdir(parents=True,exist_ok=True)
    # Lossless WebP preserves untouched pixels bit-for-bit after encoding.
    Image.fromarray(edited).save(p63,"WEBP",lossless=True,method=6)
    decoded=np.asarray(Image.open(p63).convert("RGB"))
    assert np.array_equal(original[mask==0],decoded[mask==0]), "Lossless output failed"
    Image.fromarray(mask).save(maskpng,"PNG")
    info={"photo_number":63,"recipe_n":106,"recipe_id":"collection-meat-09-08",
          "model_source":"aliceai-image-art-3.0",
          "method":"targeted pixel retouch (OpenCV) of original Alice photo, no Alice paid call",
          "source":str(source63),"source_sha256":sha(source63),
          "sha256":sha(p63),"bytes":p63.stat().st_size,
          "size":[1200,900],"mask_pixels":int(np.count_nonzero(mask)),
          "components":len(accepted),
          "outside_mask_pixels_identical":True,
          "status":"candidate_owner_review_required","site_published":False,
          "created_at":datetime.now(timezone.utc).isoformat()}
    save_json(meta63,info)
    commit_and_push("photos: retouch only green peas in sauce 63, preserving outside-mask pixels")
print("SOURCE_PRESERVED_PEAS_RETOUCHED_63",sha(p63),flush=True)

# New paid *generation* for 66 & 67 uses the project's existing Alice AI ART 3.0.
images=plan["generation"]["images"]
assert [x["number"] for x in images]==[66,67]
assert plan["generation"]["max_new_paid_requests"]==2
spec=importlib.util.spec_from_file_location("alice","_photo_source/photo-pipeline/generate_yandexart.py")
alice=importlib.util.module_from_spec(spec)
spec.loader.exec_module(alice)
assert alice.MODEL=="aliceai-image-art-3.0"
assert os.environ.get("PHOTO_COST_APPROVED")=="true"
assert os.environ.get("YANDEX_API_KEY") and os.environ.get("YANDEX_FOLDER_ID")
recipes=json.loads(Path("_photo_source/photo-library/recipes.json").read_text(encoding="utf8"))["recipes"]
by_n={int(x["n"]):x for x in recipes}
for x in images:
    n=x["number"]
    recipe=by_n[x["recipe_n"]]
    assert recipe["id"]==x["recipe_id"] and recipe["title"]==x["title"]
    assert Path(x["source"]).is_file()
    assert 1<=len(x["prompt"])<=500
    stem=f"{n:04d}-{x['recipe_id']}"
    out=ROOT/"candidates"/f"{stem}.webp"
    record=ROOT/"records"/f"{stem}.json"
    pending=ROOT/"pending"/f"{stem}.json"
    rawcheckpoint=ROOT/"raw-checkpoint"/f"{stem}.bin"
    if out.is_file() and record.is_file():
        previous=json.loads(record.read_text(encoding="utf8"))
        assert previous["sha256"]==sha(out)
        print("ALREADY_SAVED",n,flush=True)
        continue
    assert not (out.exists() or record.exists()), "Partial result; no blind retry"
    if pending.exists():
        raise RuntimeError(f"Uncertain paid request {n}; no repeat call")
    save_json(pending,{"photo_number":n,"recipe_id":x["recipe_id"],"model":"aliceai-image-art-3.0",
                       "prompt":x["prompt"],"status":"paid_request_started_never_auto_retry",
                       "started_at":datetime.now(timezone.utc).isoformat()})
    commit_and_push(f"Alice AI ART 3.0: reserve paid request {n} before API")
    raw=alice.request_image(x["prompt"],os.environ["YANDEX_API_KEY"],os.environ["YANDEX_FOLDER_ID"])
    alice.atomic_write(rawcheckpoint,raw)
    commit_and_push(f"Alice AI ART 3.0: save raw paid image {n}")
    webp=alice.encode_webp(raw)
    alice.atomic_write(out,webp)
    with Image.open(out) as im:
        assert im.size==(1200,900)
    save_json(record,{"photo_number":n,"recipe_n":x["recipe_n"],"recipe_id":x["recipe_id"],
                      "title":x["title"],"model":"aliceai-image-art-3.0",
                      "prompt":x["prompt"],"source":x["source"],
                      "sha256":sha(out),"bytes":out.stat().st_size,"size":[1200,900],
                      "status":"candidate_owner_review_required","site_published":False,
                      "generated_at":datetime.now(timezone.utc).isoformat()})
    pending.unlink()
    rawcheckpoint.unlink()
    commit_and_push(f"Alice AI ART 3.0: save irregular pork chop candidate {n}")
    print("SAVED_NEW_ALICE_CANDIDATE",n,sha(out),flush=True)
print("REWORK_COMPLETE_63_66_67",flush=True)
