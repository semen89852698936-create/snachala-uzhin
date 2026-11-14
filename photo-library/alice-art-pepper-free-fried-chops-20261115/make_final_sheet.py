#!/usr/bin/env python3
"""Build real current-photo comparison and 58–68 sheet, preserve owner approvals."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path("photo-library/alice-art-pepper-free-fried-chops-20261115")
PREV=Path("photo-library/alice-art-rework-63-66-67-20261114")
old=json.loads((PREV/"contact-sheet-manifest.json").read_text(encoding="utf8"))
approvals=json.loads(Path("photo-library/alice-art-positive-corrections-58-68-20261114/OWNER_APPROVALS_20261114.json").read_text(encoding="utf8"))["approved"]
by_approval={a["photo_number"]:a for a in approvals}
assert sorted(by_approval)==[59,61,65]
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
items=[]
for entry in old["items"]:
    n=int(entry["number"])
    photo=Path(entry["path"])
    status=entry["status"]
    if n in (63,66,67):
        rid={63:"collection-meat-09-08",66:"collection-meat-10-01",67:"collection-meat-10-02"}[n]
        if n==63:
            photo=ROOT/"polished"/f"{n:04d}-{rid}.webp"
            record=ROOT/"polished"/f"{n:04d}-{rid}.json"
        elif n==67:
            photo=ROOT/"new67/candidates"/f"{n:04d}-{rid}.webp"
            record=ROOT/"new67/records"/f"{n:04d}-{rid}.json"
        else:
            photo=ROOT/"candidates"/f"{n:04d}-{rid}.webp"
            record=ROOT/"records"/f"{n:04d}-{rid}.json"
        assert photo.is_file() and record.is_file(),f"#{n} not saved"
        meta=json.loads(record.read_text(encoding="utf8"))
        assert sha(photo)==meta["sha256"] and meta["status"]=="candidate_owner_review_required"
        status="НОВЫЙ КАНДИДАТ · НА ПРИЁМКУ"
    if n in by_approval:
        assert sha(photo)==by_approval[n]["sha256"],f"Approved image #{n} changed"
        status="УТВЕРЖДЕНО"
    items.append({**entry,"path":str(photo),"sha256":sha(photo),"status":status,
                  "approved":True if n in by_approval else (False if n in (63,66,67) else entry["approved"])})
try:
    FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    title=ImageFont.truetype(FONT,30)
    body=ImageFont.truetype(FONT,19)
    small=ImageFont.truetype(FONT,16)
except OSError:title=body=small=ImageFont.load_default()

# Three side-by-side before/after rows.
sheet=Image.new("RGB",(1040,3*405+76),"#f2eee7");draw=ImageDraw.Draw(sheet)
draw.text((20,16),"СНАЧАЛА УЖИН · ДО / ПОСЛЕ · №63, 66, 67",font=title,fill="#312622")
draw.text((20,52),"Новые кандидаты, не утверждены. Слева предыдущая версия, справа новая.",font=small,fill="#58493e")
selected={it["number"]:it for it in items}
for idx,n in enumerate([63,66,67]):
    y=76+idx*405
    draw.rounded_rectangle((14,y+5,1025,y+393),radius=10,fill="#fffdf8")
    draw.text((23,y+11),f"№{n} · {selected[n]['title']}",font=body,fill="#2a2622")
    for col,p in enumerate([Path(next(x for x in old["items"] if x["number"]==n)["path"]),Path(selected[n]["path"])]):
        img=Image.open(p).convert("RGB")
        img.thumbnail((492,336),Image.Resampling.LANCZOS)
        x=19+col*509+(492-img.width)//2
        sheet.paste(img,(x,y+39+(336-img.height)//2))
        draw.text((23+col*509,y+374),"ПРЕДЫДУЩАЯ" if col==0 else "НОВАЯ · НА ПРИЁМКУ",font=small,fill="#824e37")
comparison=ROOT/"comparison-final-63-66-67.jpg"
sheet.save(comparison,"JPEG",quality=91,subsampling=0)

# Current 58–68 in exactly same numbered order, not a stale archived collage.
w,h,pad,head=350,306,14,80
grid=Image.new("RGB",(3*w+4*pad,4*h+5*pad+head),"#f2eee7")
d=ImageDraw.Draw(grid)
d.text((20,16),"СНАЧАЛА УЖИН · КАНДИДАТЫ №58–68",font=title,fill="#312622")
d.text((20,54),"№59, 61, 65 утверждены · №63, 66, 67 на приёмку",font=small,fill="#5e4e43")
for i,it in enumerate(items):
    n=it["number"]
    x=pad+(i%3)*(w+pad);y=head+pad+(i//3)*(h+pad)
    d.rounded_rectangle((x,y,x+w,y+h),radius=7,fill="#fffdf9")
    img=Image.open(it["path"]).convert("RGB");img.thumbnail((w-14,245),Image.Resampling.LANCZOS)
    grid.paste(img,(x+(w-img.width)//2,y+7+(245-img.height)//2))
    d.text((x+8,y+258),f'№{n}  {it["title"]}',font=small,fill="#332921")
    d.text((x+8,y+280),it["status"],font=small,fill="#267849" if it["approved"] else "#8d5336")
all_path=ROOT/"contact-sheet-final-58-68.jpg"
grid.save(all_path,"JPEG",quality=91,subsampling=0)
(ROOT/"review-final-manifest.json").write_text(json.dumps({
    "model":"aliceai-image-art-3.0","items":items,"approved_numbers":[59,61,65],
    "new_review_numbers":[63,66,67],"site_published":False,
    "comparison_sha256":sha(comparison),"sheet_sha256":sha(all_path)
},ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("NEW_REVIEW_SHEETS_READY",str(comparison),str(all_path))
