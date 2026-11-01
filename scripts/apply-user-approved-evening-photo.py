#!/usr/bin/env python3
"""Apply the specific owner-selected image to the existing Our Evening page. No substitutions."""
from pathlib import Path
from PIL import Image
import hashlib,json,re
image=Path("assets/our-evening-together-approved.webp")
assert image.is_file(), "Approved image is missing"
with Image.open(image) as im:
    assert im.format=="WEBP" and im.size==(1080,1350), (im.format,im.size)
assert hashlib.sha1(b"blob "+str(image.stat().st_size).encode()+b"\\0"+image.read_bytes()).hexdigest()=="6bdd641d7aaf31a570fd740658b1aa1388a0a84b"
path=Path("index.html")
html=path.read_text(encoding="utf-8")
old='<img src="assets/cooking-together-romantic.avif" alt="Пара вместе замешивает тесто на уютной домашней кухне" loading="lazy" decoding="async">'
new='<img src="assets/our-evening-together-approved.webp" alt="Пара вместе готовит на уютной кухне в тёплом вечернем свете" loading="lazy" decoding="async">'
assert html.count(old)==1, "Old photo reference is missing or duplicated"
html=html.replace(old,new,1)
old_credit='<small class="du-evening-photo-credit">Фото: <a href="https://www.pexels.com/photo/couple-cooking-together-6962219/" target="_blank" rel="noopener noreferrer">Andy Barbour / Pexels</a></small>'
new_credit='<small class="du-evening-photo-credit">Иллюстрация проекта «СНАЧАЛА УЖИН»</small>'
assert html.count(old_credit)==1, "Old source credit is missing or duplicated"
html=html.replace(old_credit,new_credit,1)
old_css=".du-evening-together>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}"
new_css=".du-evening-together>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:54% 43%;z-index:-2}"
assert html.count(old_css)==1, "Card CSS changed unexpectedly"
html=html.replace(old_css,new_css,1)
match=re.search(r'<script id="recipeData" type="application/json">([\\s\\S]*?)</script>',html)
assert match, "Recipe dataset not found"
recipes=json.loads(match.group(1))
assert len(recipes)==1001 and len({r["id"] for r in recipes})==1001
assert 'Готовить вместе -<br><em>значит быть рядом.</em>' in html
for key in ["du-evening-role-grid","swapEveningRoles","eveningRoleStatus","eveningInviteName"]:
    assert key in html,key
path.write_text(html,encoding="utf-8")
manifest={"approved_image":"assets/our-evening-together-approved.webp","source":"Owner-selected image generated within this ChatGPT conversation","size":[1080,1350],"size_bytes":image.stat().st_size,"sha256":hashlib.sha256(image.read_bytes()).hexdigest(),"recipes_preserved":len(recipes),"status":"prepared_and_verified_not_yet_live"}
Path("photo-library/our-evening-user-approved-image.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\\n",encoding="utf-8")
print("OK: 1001 recipes preserved, owner-selected WebP linked",image.stat().st_size)
