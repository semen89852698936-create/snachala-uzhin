#!/usr/bin/env python3
"""Build owner-review contact sheets from the actual current Alice AI ART 3.0 files.
Never changes the published recipe catalog or original photo candidates.
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps, ImageFont

BASE = Path("photo-library/alice-art-positive-corrections-58-68-20261114")
SOURCE = Path("photo-library/alice-art-three-quarter-58-68-20261114/final-pass/candidates")
PILOT_67 = Path("photo-library/alice-art-angled-plus-plate-20261114/pilot-67-v2.webp")
PILOT_63 = Path("_pilot63/photo-library/alice-art-positive-pilot-63-20261114")
plan = json.loads((BASE / "plan.json").read_text(encoding="utf-8"))
assert plan["model"] == "aliceai-image-art-3.0"
new = {int(r["number"]): r for r in plan["items"]}
ids = {
    58:"collection-meat-09-03", 59:"collection-meat-09-04",
    60:"collection-meat-09-05", 61:"collection-meat-09-06",
    62:"collection-meat-09-07", 63:"collection-meat-09-08",
    64:"collection-meat-09-09", 65:"collection-meat-09-10",
    66:"collection-meat-10-01", 67:"collection-meat-10-02",
    68:"collection-meat-10-03",
}
titles = {
    58:"Мясо с горчицей и мёдом", 59:"Мясо с паприкой и чесноком",
    60:"Мясо с томатами и базиликом", 61:"Мясо с имбирём и соевым соусом",
    62:"Мясо с луком и бальзамиком", 63:"Мясо со сливками и перцем",
    64:"Мясо с яблоком и шалфеем", 65:"Мясо с черносливом и тмином",
    66:"Отбивные с лимоном и тимьяном", 67:"Отбивные с грибами и розмарином",
    68:"Отбивные с горчицей и мёдом",
}
def file_for(n):
    return SOURCE / f"{n:04d}-{ids[n]}.webp"
def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def verify(n, path, record):
    meta = json.loads(record.read_text(encoding="utf-8"))
    assert meta["sha256"] == sha256(path), f"SHA mismatch #{n}"
    assert meta.get("site_published") is False, n
    return meta

items = []
for n in range(58, 69):
    original = file_for(n)
    assert original.is_file(), f"Missing original {n}"
    path = original
    status = "ОРИГИНАЛ · БЕЗ ПРАВОК"
    origin = "original"
    if n in new:
        path = BASE / "candidates" / f"{n:04d}-{ids[n]}.webp"
        record = BASE / "records" / f"{n:04d}-{ids[n]}.json"
        assert path.is_file() and record.is_file(), f"New correction #{n} not saved"
        meta = verify(n, path, record)
        assert meta["model"] == "aliceai-image-art-3.0"
        status = "НОВАЯ ПОПЫТКА · НА ПРОВЕРКУ"
        origin = "positive-only candidate"
    elif n == 63:
        candidate = PILOT_63 / "candidates" / f"{n:04d}-{ids[n]}.webp"
        record = PILOT_63 / "records" / f"{n:04d}-{ids[n]}.json"
        if candidate.exists() and record.exists():
            meta = verify(n, candidate, record)
            assert meta["model"] == "aliceai-image-art-3.0"
            path = candidate
            status = "ПРОБА №63 · НА ПРОВЕРКУ"
            origin = "pilot63 recorded candidate"
        else:
            status = "ПОВТОР №63 ПОКА НЕ ГОТОВ"
            origin = "original pending pilot"
    elif n == 67:
        assert PILOT_67.is_file(), "Missing boneless pilot-67-v2"
        path = PILOT_67
        meta = json.loads(PILOT_67.with_suffix(".json").read_text(encoding="utf-8"))
        assert sha256(path) == meta["sha256"]
        status = "ПРОБА БЕЗ КОСТИ · НА ПРОВЕРКУ"
        origin = "pilot67-v2"
    items.append({"number":n,"title":titles[n], "path":str(path),
                  "origin":origin,"status":status,"sha256":sha256(path),
                  "approved":False if origin != "original" else None,
                  "site_published_by_this_workflow":False})

try:
    FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    title_font = ImageFont.truetype(FONT, 24)
    body_font = ImageFont.truetype(FONT, 18)
    top_font = ImageFont.truetype(FONT, 36)
    small_font = ImageFont.truetype(FONT, 16)
except OSError:
    title_font = body_font = top_font = small_font = ImageFont.load_default()

tile_w, tile_h = 388, 358
columns = 3
pad = 18
header = 100
rows = (len(items) + columns - 1) // columns
sheet = Image.new("RGB",(columns * tile_w + (columns+1)*pad,
                         header + rows * tile_h + (rows+1)*pad), "#f1eee8")
d = ImageDraw.Draw(sheet)
d.text((24,20), "СНАЧАЛА УЖИН · №58–68",font=top_font,fill="#342c28")
d.text((24,66), "Новые попытки отмечены. Все фотографии требуют визуальной приёмки.",font=body_font,fill="#54483f")
for i, item in enumerate(items):
    col, row = i%columns, i//columns
    x = pad + col*(tile_w+pad)
    y = header+pad+row*(tile_h+pad)
    d.rounded_rectangle((x,y,x+tile_w,y+tile_h),radius=8,fill="#fffdf9")
    im = Image.open(item["path"]).convert("RGB")
    im.thumbnail((tile_w-20,276),Image.Resampling.LANCZOS)
    offset=((tile_w-im.width)//2, (276-im.height)//2)
    sheet.paste(im,(x+offset[0],y+7+offset[1]))
    d.text((x+12,y+284),f'№{item["number"]}  {item["title"]}',font=small_font,fill="#2e2622")
    color = "#974b30" if "НОВАЯ" in item["status"] else "#5b615f"
    d.text((x+12,y+311),item["status"],font=small_font,fill=color)
outfile = BASE/"contact-sheet-current-58-68.jpg"
sheet.save(outfile,"JPEG",quality=92,subsampling=0)

comparison = [n for n in [59,61,63,65,66,67] if n in ids]
comp_w=870
comp_h=310
before_after=Image.new("RGB",(comp_w,len(comparison)*comp_h+70),"#f1eee8")
dc=ImageDraw.Draw(before_after)
dc.text((20,13),"БЫЛО / ТЕКУЩАЯ ПОПЫТКА · НА ПРИЁМКУ",font=title_font,fill="#342c28")
dc.text((20,45),"Снимки справа не считаются утверждёнными.",font=small_font,fill="#6c574b")
by_n={it["number"]:it for it in items}
for idx,n in enumerate(comparison):
    y=70+idx*comp_h
    label_y=y+4
    dc.text((18,label_y),f'№{n}  {titles[n]}',font=body_font,fill="#302824")
    for c,path in enumerate([file_for(n), Path(by_n[n]["path"])]):
        img=Image.open(path).convert("RGB")
        img.thumbnail((410,256),Image.Resampling.LANCZOS)
        offset= (410-img.width)//2
        before_after.paste(img,(20+c*430+offset,y+38))
        dc.text((20+c*430,y+290),"БЫЛО" if c==0 else by_n[n]["status"],font=small_font,fill="#765142")
before_after.save(BASE/"comparison-before-current.jpg","JPEG",quality=92,subsampling=0)

manifest={"model":"aliceai-image-art-3.0","sheet_sha256":sha256(outfile),
          "generated_at":datetime.now(timezone.utc).isoformat(),
          "all_published":False,"items":items}
(BASE/"contact-sheet-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("BUILT_CONTACT_SHEET",outfile, "new",sorted(new))
