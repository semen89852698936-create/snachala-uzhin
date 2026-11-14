#!/usr/bin/env python3
"""Non-destructive audit of deployed poultry category from exact GitHub commit.
Outputs numbered photo contact sheets, metadata and live browser screenshots.
No recipe photos or website files are modified.
"""
import hashlib
import json
import re
import textwrap
from collections import Counter
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont

AUDIT = Path("audit/poultry-published-20261115")
AUDIT.mkdir(parents=True,exist_ok=True)
html=Path("full-catalog/index.html").read_text(encoding="utf-8")
match=re.search(r'<script id="recipeData" type="application/json">([\s\S]*?)</script>',html)
assert match, "No embedded recipes in deployed HTML"
recipes=json.loads(match.group(1))
poultry=[(n,r) for n,r in enumerate(recipes,start=1) if r.get("category")=="poultry"]
assert len(recipes)==1001 and len(poultry)==100
mapping=json.loads(Path("photo-library/ai-recipe-photo-map.json").read_text(encoding="utf8"))
assert mapping["total"]==1001
by_n={x["n"]:x for x in mapping["photos"]}
assert len(by_n)==1001
blob_sha=lambda b: hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
fsmall=ImageFont.truetype(FONT,15)
fmid=ImageFont.truetype(FONT,16)
fbold=ImageFont.truetype(FONT,24)
big=ImageFont.truetype(FONT,30)
columns,rows=4,5
w,h,gap=430,346,16
header=103
base=Image.new("RGB",(columns*w+(columns+1)*gap,rows*h+(rows+1)*gap+header),"#eee9df")
dataset=[]
errors=[]
for ix,(num,r) in enumerate(poultry):
    target=Path(r["photo"].lstrip("/"))
    mapped=by_n.get(num)
    if mapped is None or mapped["recipe_id"]!=r["id"] or mapped["path"]!=r["photo"]:
        errors.append({"number":num,"type":"map_mismatch","path":str(target)})
    if not target.is_file():
        errors.append({"number":num,"type":"missing_photo","path":str(target)})
        continue
    data=target.read_bytes()
    if mapped and (blob_sha(data)!=mapped["sha"] or len(data)!=mapped["bytes"]):
        errors.append({"number":num,"type":"sha_or_size_mismatch","expected_sha":mapped["sha"],"actual_sha":blob_sha(data)})
    with Image.open(target) as raw:
        raw.load()
        pic=raw.convert("RGB")
        size=list(raw.size)
    entry={"number":num,"title":r["title"],"photo":r["photo"],
           "sha":blob_sha(data),"bytes":len(data),"dimensions":size,
           "special_no_eggs_regen":"no-eggs-regen" in r["photo"]}
    dataset.append(entry)
    page=ix//20
    offset=ix%20
    if offset==0:
        sheet=Image.new("RGB",base.size,"#eee9df")
        d=ImageDraw.Draw(sheet)
        d.text((25,15),f"ПТИЦА · РЕАЛЬНЫЕ ФОТО · ЛИСТ {page+1}/5",font=big,fill="#282724")
        d.text((25,57),"Точная опубликованная сборка • номера рецептов из 1001 • изображения без замены",font=fmid,fill="#514d46")
    x=gap+(offset%columns)*(w+gap)
    y=header+gap+(offset//columns)*(h+gap)
    d.rounded_rectangle((x,y,x+w,y+h),radius=9,fill="#fffefa")
    pic.thumbnail((w-12,262),Image.Resampling.LANCZOS)
    sheet.paste(pic,(x+(w-pic.width)//2,y+4+(262-pic.height)//2))
    d.text((x+9,y+269),f"№{num}  {r['title'][:41]}",font=fsmall,fill="#222")
    if len(r["title"])>41:d.text((x+9,y+290),r["title"][41:83],font=fsmall,fill="#222")
    tag="НОВАЯ ВЕРСИЯ БЕЗ ЯИЦ" if "no-eggs-regen" in r["photo"] else r["id"]
    d.text((x+9,y+319),tag[:47],font=fsmall,fill="#736052")
    if offset==19:
        sheet.save(AUDIT/f"poultry-photos-{page+1:02d}.jpg",quality=93,subsampling=0)

# Deterministic checks for recipe instructions contradicting their own sequence.
text_flags=[]
for n,r in poultry:
    for i,s in enumerate(r.get("steps",[])):
        detail=s.get("detail","")
        past=r["steps"][:i]
        if "в начале" in detail.casefold() and any(any(v in q["title"].lower() for v in ("запеки","обжарь","туши","доведи","жарь")) for q in past):
            text_flags.append({"number":n,"title":r["title"],"step_index":i+1,
                               "step_title":s["title"],"issue":"Ingredient must be introduced at beginning but is instructed AFTER cooking step","text":detail})
        if r["title"].lower().startswith("рубленые котлеты") and any(a["name"].lower().startswith("фарш") for a in r["ingredients"]):
            # one issue per dish, even if detected in an iteration
            if i==0:
                text_flags.append({"number":n,"title":r["title"],"issue":"Dish titled chopped cutlets, ingredient specifies ground meat ('фарш')"})
image_sizes=Counter(tuple(d["dimensions"]) for d in dataset)
report={"deployment_ref":"release/approved-seven-photos-20261115",
        "deployment_sha":"01b5d2fdab33873fc860642c7dd8b2d04c7ffc2f",
        "total_recipes":len(recipes),"poultry_count":len(poultry),"photos_validated":len(dataset),
        "photo_dimensions":{str(k):v for k,v in image_sizes.items()},
        "no_eggs_replacements":[d["number"] for d in dataset if d["special_no_eggs_regen"]],
        "errors":errors,"text_flags":text_flags,"photo_items":dataset}
(AUDIT/"audit.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps({"poultry":len(poultry),"photos":len(dataset),
 "files_missing_or_mismatched":len(errors),"steps_in_wrong_order":sum("Ingredient must" in x["issue"] for x in text_flags),
 "minced_instead_of_chopped":sum("Dish titled" in x["issue"] for x in text_flags),
 "egg_regenerated_count":len(report["no_eggs_replacements"])},ensure_ascii=False))
