#!/usr/bin/env python3
"""Deploy exactly the user-selected cropped visual. No substituted stock or AI re-generation."""
from pathlib import Path
from PIL import Image
import base64, hashlib, io, json, re

payload_dir=Path("photo-library/approved-image-payload")
parts=sorted(payload_dir.glob("chunk-*.txt"))
assert len(parts)==8, f"Expected 8 chunks, got {len(parts)}"
base64text="".join(p.read_text(encoding="ascii").strip() for p in parts)
compressed=base64.b64decode(base64text,validate=True)
assert hashlib.sha256(compressed).hexdigest()=="482cdf30dfcfc93bc756987c49c63a57e24499079efdd0078e5ba513b115ccf3", "Approved image payload does not match uploaded photo"
with Image.open(io.BytesIO(compressed)) as image:
    assert image.format=="AVIF" and image.size==(960,1200), f"Unexpected source: {image.format}, {image.size}"
    image=image.convert("RGB")
    out=Path("assets/our-evening-together-approved.webp")
    image.save(out,"WEBP",quality=90,method=6)
    with Image.open(out) as c:
        assert c.format=="WEBP" and c.size==(960,1200)
html_path=Path("index.html")
html=html_path.read_text(encoding="utf-8")
old_src='<img src="assets/cooking-together-romantic.avif" alt="Пара вместе замешивает тесто на уютной домашней кухне" loading="lazy" decoding="async">'
new_src='<img src="assets/our-evening-together-approved.webp" alt="Пара вместе готовит на уютной кухне в тёплом вечернем свете" loading="lazy" decoding="async">'
assert html.count(old_src)==1, "Old photo is not at the expected position"
html=html.replace(old_src,new_src,1)
old_credit='<small class="du-evening-photo-credit">Фото: <a href="https://www.pexels.com/photo/couple-cooking-together-6962219/" target="_blank" rel="noopener noreferrer">Andy Barbour / Pexels</a></small>'
new_credit='<small class="du-evening-photo-credit">Иллюстрация проекта «СНАЧАЛА УЖИН»</small>'
assert html.count(old_credit)==1, "Expected outdated credit exactly once"
html=html.replace(old_credit,new_credit,1)
# Keep the photo sharp and centered on faces / prep work at all viewports.
style_old=".du-evening-together>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}"
style_new=".du-evening-together>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:54% 43%;z-index:-2}"
assert html.count(style_old)==1
html=html.replace(style_old,style_new,1)
json_match=re.search(r'<script id="recipeData" type="application/json">([\s\S]*?)</script>',html)
assert json_match
recipes=json.loads(json_match.group(1))
assert len(recipes)==1001 and len({r["id"] for r in recipes})==1001
assert 'Готовить вместе -<br><em>значит быть рядом.</em>' in html
for selector in ['du-evening-role-grid','swapEveningRoles','eveningRoleStatus','eveningInviteName']:
    assert selector in html
html_path.write_text(html,encoding="utf-8")
manifest={
 "title":"Approved Our Evening photo",
 "source":"User-selected image generated in ChatGPT, cropped to remove unused left/right sides",
 "source_sha256":hashlib.sha256(compressed).hexdigest(),
 "image_file":str(out),"dimensions":[960,1200],"final_sha256":hashlib.sha256(out.read_bytes()).hexdigest(),
 "status":"code_verified_not_live_until_deployment_confirmed",
 "last_checked_recipes":len(recipes)
}
Path("photo-library/our-evening-user-approved-image.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("OK",str(out),out.stat().st_size,"bytes; recipes",len(recipes))