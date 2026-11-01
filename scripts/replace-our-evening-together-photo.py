#!/usr/bin/env python3
"""Replace the approved Our Evening together card photo with a crisp real photograph."""
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen
import hashlib, json, re, time
from PIL import Image, ImageOps, ImageEnhance

src_url="https://images.pexels.com/photos/27176133/pexels-photo-27176133.jpeg?auto=compress&cs=tinysrgb&w=2800"
source_page="https://www.pexels.com/photo/couple-enjoys-cooking-together-in-kitchen-27176133/"
destination=Path("assets/our-evening-together-helena-lopes-hq.webp")
htmlpath=Path("index.html")
html=htmlpath.read_text(encoding="utf-8")
old_asset='assets/cooking-together-romantic.avif'
old_credit='<small class="du-evening-photo-credit">Фото: <a href="https://www.pexels.com/photo/couple-cooking-together-6962219/" target="_blank" rel="noopener noreferrer">Andy Barbour / Pexels</a></small>'
new_credit=f'<small class="du-evening-photo-credit">Фото: <a href="{source_page}" target="_blank" rel="noopener noreferrer">Helena Lopes / Pexels</a></small>'
assert html.count(old_asset)==1, "Expected exactly one original photo reference"
assert html.count(old_credit)==1, "Expected exactly one original photographer credit"
old_recipe=re.search(r'<script id="recipeData" type="application/json">(.*?)</script>',html,re.S)
assert old_recipe, "Recipe data missing"
for attempt in range(3):
    try:
        req=Request(src_url, headers={"User-Agent":"Mozilla/5.0"})
        with urlopen(req, timeout=35) as response:
            assert response.headers.get("Content-Type","").startswith("image/")
            data=response.read()
        break
    except Exception:
        if attempt==2: raise
        time.sleep(3*(attempt+1))
original=Image.open(BytesIO(data)).convert("RGB")
assert min(original.size)>=1200, f"Source image unexpectedly small: {original.size}"
# Square card crop: preserve the couple and kitchen without stretching the image.
final=ImageOps.fit(original,(1800,1800),method=Image.Resampling.LANCZOS,centering=(0.50,0.46))
final=ImageEnhance.Contrast(final).enhance(1.025)
final.save(destination,"WEBP",quality=90,method=6)
with Image.open(destination) as verified:
    assert verified.format=="WEBP" and verified.size==(1800,1800)
assert destination.stat().st_size>110_000, "Not enough quality to replace the previous tiny image"
html=html.replace(old_asset,str(destination),1).replace(old_credit,new_credit,1)
html=html.replace('alt="Пара вместе замешивает тесто на уютной домашней кухне"','alt="Пара готовит ужин вместе на уютной домашней кухне"',1)
new_recipe=re.search(r'<script id="recipeData" type="application/json">(.*?)</script>',html,re.S)
assert new_recipe and new_recipe.group(1)==old_recipe.group(1), "Recipe data must remain unchanged"
assert html.count(str(destination))==1
assert 'Готовить вместе -<br><em>значит быть рядом.</em>' in html
assert html.count("du-evening-role-grid")>=1
htmlpath.write_text(html,encoding="utf-8")
details={
  "asset":str(destination),"source_page":source_page,"photographer":"Helena Lopes",
  "license":"Pexels License","license_url":"https://www.pexels.com/license/",
  "resolution":[1800,1800],"format":"WebP","bytes":destination.stat().st_size,
  "sha256":hashlib.sha256(destination.read_bytes()).hexdigest(),
  "old_asset":old_asset,"replaces_card":"Готовить вместе - значит быть рядом",
  "license_notes":"Pexels free-license photo; no implied endorsement of the website by subjects",
  "verified":"image format, dimensions, recipe dataset unchanged and credit updated",
  "status":"prepared_for_preview"
}
Path("photo-library/our-evening-together-photo-20261101.json").write_text(json.dumps(details,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
print("CREATED",destination,"bytes",destination.stat().st_size,"original",original.size)
print("REPLACED exactly one image and photographer credit; recipe data unchanged")
