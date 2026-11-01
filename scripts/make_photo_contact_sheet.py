#!/usr/bin/env python3
"""Build review contact sheet from actual saved WebP files (not source links)."""
import json
import math
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "photo-library/candidates-21-120"
manifest_path = OUT / "manifest.json"
if not manifest_path.exists():
    raise SystemExit("No manifest; nothing to display")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
photos = manifest["photos"]
if not photos:
    raise SystemExit("No downloaded candidates; no contact sheet")
cols, cell_w, image_h, label_h = 5, 300, 225, 42
rows = math.ceil(len(photos)/cols)
canvas = Image.new("RGB", (cols*cell_w, rows*(image_h+label_h)), (248,238,231))
draw = ImageDraw.Draw(canvas)
for i, p in enumerate(photos):
    fp = ROOT/p["file"]
    with Image.open(fp) as im:
        im = ImageOps.fit(im.convert("RGB"), (cell_w, image_h))
    x, y = (i%cols)*cell_w, (i//cols)*(image_h+label_h)
    canvas.paste(im, (x,y))
    draw.rectangle([x,y+image_h,x+cell_w,y+image_h+label_h],fill=(246,237,229))
    draw.text((x+10,y+image_h+12),f"#{p['n']:03d} · {p['recipe_id'][-13:]}",fill=(95,43,42))
path=OUT/"contact-sheet.webp"
canvas.save(path,"WEBP",quality=80,method=6)
print(f"Contact sheet: {path} with {len(photos)} actual photos")
