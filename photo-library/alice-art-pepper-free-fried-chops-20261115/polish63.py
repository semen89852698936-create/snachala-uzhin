#!/usr/bin/env python3
"""Remove visible inpainting facets in cream while leaving outside sauce untouched."""
import hashlib,json
from pathlib import Path
import cv2,numpy as np
from PIL import Image
ROOT=Path("photo-library/alice-art-pepper-free-fried-chops-20261115")
plan=json.loads((ROOT/"plan.json").read_text(encoding="utf8"))
original=np.asarray(Image.open(plan["photo63"]["source"]).convert("RGB")).copy()
current=np.asarray(Image.open(ROOT/"candidates/0063-collection-meat-09-08.webp").convert("RGB")).copy()
mask=np.asarray(Image.open(ROOT/"qa-mask-63.png").convert("L"))
assert original.shape==current.shape==(900,1200,3)
assert mask.shape==(900,1200)
assert np.array_equal(original[mask==0],current[mask==0])

roi=np.zeros((900,1200),np.uint8)
polygon=np.array([[125,518],[170,446],[238,422],[354,420],[481,465],
                  [549,506],[612,580],[625,684],[549,744],[327,757],
                  [159,706],[123,626]],np.int32)
cv2.fillPoly(roi,[polygon],255)
r=original[:,:,0].astype(np.int16)
g=original[:,:,1].astype(np.int16)
b=original[:,:,2].astype(np.int16)
# Only sample visibly unmodified cream near green-pepper mask.
cream=(roi>0)&(mask==0)&(r>190)&(g>156)&(b>92)&(r-g>6)&(r-g<79)&(g-b>10)&(g-b<100)
ys,xs=np.nonzero(cream)
if len(xs)<1500:raise RuntimeError(f"Insufficient clean sauce reference pixels {len(xs)}")
rng=np.random.default_rng(63)
if len(xs)>22000:
    indices=rng.choice(len(xs),22000,replace=False)
    xs=xs[indices];ys=ys[indices]

def features(xx,yy):
    xx=(np.asarray(xx,dtype=float)-375.)/300.
    yy=(np.asarray(yy,dtype=float)-590.)/220.
    return np.column_stack([np.ones(xx.size),xx,yy,xx**2,xx*yy,yy**2])
A=features(xs,ys)
pixels=original[ys,xs].astype(float)
coef=np.linalg.lstsq(A,pixels,rcond=None)[0]
# Trim outlying cream-to-plate transitions and refit.
err=np.linalg.norm(pixels-A@coef,axis=1)
good=err<np.percentile(err,75)
coef=np.linalg.lstsq(A[good],pixels[good],rcond=None)[0]
ym,xm=np.nonzero(mask>0)
estimated=features(xm,ym)@coef
estimated=np.clip(estimated,0,255)
# Slight small-scale sauce texture avoids plastic-looking solid color.
grain=np.random.default_rng(1063).normal(0,1.25,(len(ym),1))
estimated=np.clip(estimated+grain,0,255)
dist=cv2.distanceTransform((mask>0).astype(np.uint8),cv2.DIST_L2,3)
alpha=np.clip(dist[ym,xm]/13.0,0,1)
new=current.copy().astype(float)
new[ym,xm]=current[ym,xm]*(1-alpha[:,None])+estimated*alpha[:,None]
new=new.clip(0,255).astype(np.uint8)
assert np.array_equal(original[mask==0],new[mask==0])
out=ROOT/"polished/0063-collection-meat-09-08.webp"
out.parent.mkdir(parents=True,exist_ok=True)
Image.fromarray(new).save(out,"WEBP",lossless=True,method=6)
recheck=np.asarray(Image.open(out).convert("RGB"))
assert np.array_equal(original[mask==0],recheck[mask==0])
digest=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
record={"number":63,"model_source":"aliceai-image-art-3.0","method":"smooth sauce color reconstruction inside former green-pepper edit mask", "source":plan["photo63"]["source"],"previous_retouch":"candidates/0063-collection-meat-09-08.webp","sha256":digest(out),"outside_edited_sauce_pixels_identical_to_original":True,"mask_pixels":int(np.count_nonzero(mask)),"clean_cream_samples":int(len(xs)),"site_published":False,"status":"candidate_owner_review_required"}
(ROOT/"polished/0063-collection-meat-09-08.json").write_text(json.dumps(record,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("SAUCE_63_SMOOTHED_AND_SAVED",digest(out))
