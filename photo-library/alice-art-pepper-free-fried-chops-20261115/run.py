#!/usr/bin/env python3
"""Alice AI ART 3.0: precise green-pepper removal #63; two cooked pork candidates #66/#67."""
import hashlib,importlib.util,json,os,subprocess
from pathlib import Path
from datetime import datetime,timezone
import cv2,numpy as np
from PIL import Image

ROOT=Path("photo-library/alice-art-pepper-free-fried-chops-20261115")
BRANCH="photo-production/alice-art-pepper-free-fried-chops-20261115"
plan=json.loads((ROOT/"plan.json").read_text(encoding="utf-8"))
assert plan["model"]=="aliceai-image-art-3.0" and plan["site_published"] is False
approvals=json.loads(Path(plan["approved_file"]).read_text(encoding="utf8"))["approved"]
assert sorted(a["photo_number"] for a in approvals)==[59,61,65]
def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
for a in approvals:assert Path(a["path"]).is_file() and digest(a["path"])==a["sha256"]
def git(*args):subprocess.run(["git",*args],check=True)
def savejson(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_name(path.name+".tmp")
    tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    tmp.replace(path)
def save_progress(msg):
    git("add","-A",str(ROOT))
    git("diff","--cached","--check")
    if subprocess.run(["git","diff","--cached","--quiet"]).returncode:
        git("commit","-m",msg)
        git("push","origin","HEAD:refs/heads/"+BRANCH)
git("config","user.name","github-actions[bot]")
git("config","user.email","41898282+github-actions[bot]@users.noreply.github.com")

# #63: change only green spherical pepper in the creamy sauce.
# Keep every pixel outside inpaint mask exactly as in ORIGINAL Alice photograph.
s=plan["photo63"]
src=Path(s["source"])
p63=ROOT/"candidates"/"0063-collection-meat-09-08.webp"
r63=ROOT/"records"/"0063-collection-meat-09-08.json"
if p63.exists() and r63.exists():
    info=json.loads(r63.read_text(encoding="utf8"))
    assert info["sha256"]==digest(p63) and info["outside_mask_pixels_identical"]
    print("EXISTING_63_VERIFIED",flush=True)
else:
    assert not p63.exists() and not r63.exists(),"Partial #63 file"
    original=np.asarray(Image.open(src).convert("RGB")).copy()
    assert original.shape==(900,1200,3)
    roi=np.zeros((900,1200),np.uint8)
    polygon=np.array([[125,518],[170,446],[238,422],[354,420],[481,465],
                      [549,506],[612,580],[625,684],[549,744],[327,757],
                      [159,706],[123,626]],np.int32)
    cv2.fillPoly(roi,[polygon],255)
    hsv=cv2.cvtColor(original,cv2.COLOR_RGB2HSV)
    green=cv2.inRange(hsv,(27,34,22),(98,255,255))
    green=cv2.bitwise_and(green,roi)
    # Include pale edges and shadows around each sphere; partial color threshold
    # was the reason earlier retouch left green pebbles and pale green halos.
    cleaned=cv2.morphologyEx(green,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    count,labels,stats,_=cv2.connectedComponentsWithStats(cleaned,connectivity=8)
    mask=np.zeros_like(roi)
    seeds=0
    for i in range(1,count):
        x,y,w,h,area=map(int,stats[i])
        if area<22 or w<4 or h<4 or w>130 or h>130:continue
        radius=max(16,min(45,int(max(w,h)*.65+11)))
        cv2.circle(mask,(x+w//2,y+h//2),radius,255,-1)
        seeds+=1
    # Sweep remaining chromatic pepper parts, including fine green satellites.
    mask=cv2.bitwise_or(mask,cv2.dilate(green,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(33,33))))
    mask=cv2.bitwise_and(mask,roi)
    assert seeds>=8 and np.count_nonzero(mask)>=25000,"Unsafe sparse sauce mask"
    result=cv2.inpaint(original,mask,10,cv2.INPAINT_TELEA)
    # Second residual color pass. Repaint only the same local sauce zone.
    after_green=cv2.bitwise_and(cv2.inRange(cv2.cvtColor(result,cv2.COLOR_RGB2HSV),(27,34,22),(98,255,255)),roi)
    after_green=cv2.bitwise_and(after_green,cv2.bitwise_not(mask))
    if np.count_nonzero(after_green)>120:
        extra=cv2.dilate(after_green,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(31,31)))
        mask=cv2.bitwise_or(mask,cv2.bitwise_and(extra,roi))
        result=cv2.inpaint(original,mask,10,cv2.INPAINT_TELEA)
    assert np.array_equal(original[mask==0],result[mask==0])
    p63.parent.mkdir(parents=True,exist_ok=True)
    Image.fromarray(result).save(p63,"WEBP",lossless=True,method=6)
    decoded=np.array(Image.open(p63).convert("RGB"))
    assert np.array_equal(original[mask==0],decoded[mask==0])
    Image.fromarray(mask).save(ROOT/"qa-mask-63.png","PNG")
    info={"photo_number":63,"recipe_n":106,"recipe_id":"collection-meat-09-08",
          "model_source":"aliceai-image-art-3.0","method":"precise local retouch, no paid image request",
          "source":str(src),"sha256":digest(p63),"source_sha256":digest(src),
          "mask_pixels":int(np.count_nonzero(mask)),"detected_green_clusters":seeds,
          "outside_mask_pixels_identical":True,"site_published":False,
          "status":"candidate_owner_review_required",
          "created_at":datetime.now(timezone.utc).isoformat()}
    savejson(r63,info)
    save_progress("photos: erase green pepper spheres in sauce #63, keep surroundings pixel-identical")
    print("SAVED_RETOUCHED_63",info["sha256"],info["mask_pixels"],flush=True)

# #66/#67: Generate fresh cooked brown irregularly-shaped pork cutlets using
# only positive descriptions, avoiding bone/raw-meat words in paid prompts.
cfg=plan["generation"]
assert cfg["max_new_paid_requests"]==len(cfg["items"])==2
assert [x["number"] for x in cfg["items"]]==[66,67]
spec=importlib.util.spec_from_file_location("alice","_photo_source/photo-pipeline/generate_yandexart.py")
alice=importlib.util.module_from_spec(spec);spec.loader.exec_module(alice)
assert alice.MODEL=="aliceai-image-art-3.0"
recipes=json.loads(Path("_photo_source/photo-library/recipes.json").read_text(encoding="utf8"))["recipes"]
known={int(x["n"]):x for x in recipes}
for x in cfg["items"]:
    n=x["number"];stem=f"{n:04d}-{x['recipe_id']}"
    assert x["recipe_id"]==known[int(x["recipe_n"])]["id"]
    assert x["title"]==known[int(x["recipe_n"])]["title"]
    assert 0<len(x["prompt"])<=500 and Path(x["source"]).is_file()
    out=ROOT/"candidates"/f"{stem}.webp"
    record=ROOT/"records"/f"{stem}.json"
    pending=ROOT/"pending"/f"{stem}.json"
    raw=ROOT/"raw-checkpoint"/f"{stem}.bin"
    if out.exists() and record.exists():
        meta=json.loads(record.read_text(encoding="utf8"))
        assert digest(out)==meta["sha256"]
        print("EXISTING_CANDIDATE",n,flush=True);continue
    assert not out.exists() and not record.exists(),"Partial result"
    assert not pending.exists() and not raw.exists(),"Uncertain paid result, no repeat request"
    assert os.environ["PHOTO_COST_APPROVED"]=="true"
    assert os.environ.get("YANDEX_API_KEY") and os.environ.get("YANDEX_FOLDER_ID")
    savejson(pending,{"number":n,"model":"aliceai-image-art-3.0","status":"paid_request_started_never_auto_retry",
                      "prompt":x["prompt"],"started_at":datetime.now(timezone.utc).isoformat()})
    save_progress(f"Alice AI ART: reserve paid cooked irregular pork image {n}")
    response=alice.request_image(x["prompt"],os.environ["YANDEX_API_KEY"],os.environ["YANDEX_FOLDER_ID"])
    alice.atomic_write(raw,response)
    save_progress(f"Alice AI ART: checkpoint paid raw result {n}")
    data=alice.encode_webp(response)
    alice.atomic_write(out,data)
    with Image.open(out) as pic:assert pic.size==(1200,900)
    meta={"photo_number":n,"recipe_n":x["recipe_n"],"recipe_id":x["recipe_id"],
          "title":x["title"],"model":"aliceai-image-art-3.0","prompt":x["prompt"],
          "source":x["source"],"sha256":digest(out),"bytes":len(data),
          "status":"candidate_owner_review_required","site_published":False,
          "generated_at":datetime.now(timezone.utc).isoformat()}
    savejson(record,meta)
    pending.unlink();raw.unlink()
    save_progress(f"Alice AI ART: save cooked irregular pork candidate {n}")
    print("SAVED_CANDIDATE",n,meta["sha256"],flush=True)
print("REWORK_63_66_67_SAVED_FOR_REVIEW_ONLY",flush=True)
