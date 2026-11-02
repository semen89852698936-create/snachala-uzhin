#!/usr/bin/env python3
"""Verify all 1001 photos and their exact links in both catalog HTML pages."""
import json, re, hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
photos=json.loads((root/"photo-library/ai-recipe-photo-map.json").read_text(encoding="utf-8"))["photos"]
assert len(photos)==1001
assert len({p["recipe_id"] for p in photos})==1001
for i,p in enumerate(photos,1):
    assert p["n"]==i
    file=root/p["path"].lstrip("/")
    binary=file.read_bytes()
    assert len(binary)==p["bytes"],(i,"size")
    assert binary.startswith(b"RIFF") and binary[8:12]==b"WEBP",(i,"format")
    gitsha=hashlib.sha1(b"blob "+str(len(binary)).encode()+b"\0"+binary).hexdigest()
    assert gitsha==p["sha"],(i,"gitsha")
for url in ("index.html","full-catalog/index.html"):
    html=(root/url).read_text(encoding="utf-8")
    match=re.search(r'<script id="recipeData" type="application/json">(.*?)</script>',html,re.S)
    assert match,url
    data=json.loads(match.group(1))
    assert len(data)==1001,url
    for i,(recipe,photo) in enumerate(zip(data,photos),1):
        assert recipe["id"]==photo["recipe_id"],(url,i,"id")
        assert recipe["photo"]==photo["path"],(url,i,"path")
    assert 'href="#evening" data-nav="evening">Наш вечер</a>' in html,url
    assert 'href="#evening">Наш вечер</a>' in html,url
    assert '.main-nav a[data-nav="evening"]' in html,url
    assert 'function renderRecipes()' in html,url
    assert 'function renderRecipe(' in html,url
    for cat in ("meat","poultry","fish","pasta","vegetables","pastry","soup","salads","dessert","breakfast"):
        assert re.search(r"\{id:'"+cat+r"',[^\n]*photo:'/assets/recipes-ai/[^']+\.webp'",html),(url,cat)
    print("PASS",url,"1001 image mappings, 10 category images, prominent Our Evening CTA")
print("PASS 1001 unique WebP, exact file sizes, Git blob hashes")
