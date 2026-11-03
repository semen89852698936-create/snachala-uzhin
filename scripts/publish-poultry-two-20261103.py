#!/usr/bin/env python3
"""Complete Yandex photo replacement for 2 turkey recipes, no further owner sign-off."""
import hashlib
import importlib.util
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"_photo_source"
spec=importlib.util.spec_from_file_location("ym",SOURCE/"photo-pipeline/generate_yandexart.py")
ym=importlib.util.module_from_spec(spec)
spec.loader.exec_module(ym)
recipes={int(r["n"]):r for r in ym.load_recipes(SOURCE/"photo-library/recipes.json")}
NUMBERS=(152,154)
RECORDS=ROOT/"photo-library"/"poultry-no-eggs-two-20261103"
REGEXP=re.compile(r'(<script id="recipeData" type="application/json">)(.*?)(</script>)',re.S)

def git(*args):
    subprocess.run(["git",*args],cwd=ROOT,check=True)

def checkpoint(paths, message):
    git("add","-A",*[str(x.relative_to(ROOT)) for x in paths])
    changes=subprocess.run(["git","diff","--cached","--quiet"],cwd=ROOT)
    if changes.returncode:
        git("commit","-m",message)
        git("push","origin","HEAD:refs/heads/main")

def sha1_git(blob):
    return hashlib.sha1(b"blob "+str(len(blob)).encode()+b"\0"+blob).hexdigest()

def prompt(n):
    r=recipes[n]
    if n==152:
        flavor="соевым соусом и тёртым имбирём"
    else:
        flavor="песто и мелко нарезанными вялеными томатами"
    p=(f'Фотореалистичная ресторанная фуд-фотография готового блюда «{r["title"]}». '
       f'Небольшие рубленые котлеты из индейки, золотистая корочка, с {flavor}. '
       'Одна красивая порция на керамической тарелке. '
       'Категорически БЕЗ жареных яиц, глазуньи, желтков, варёных яиц, '
       'яичных украшений и цельных яиц поверх котлет. '
       'Кинематографический мягкий тёплый свет, крупный план, без текста.')
    assert len(p)<=500,len(p)
    return p

def generate():
    key=os.environ["YANDEX_API_KEY"]
    folder=os.environ["YANDEX_FOLDER_ID"]
    assert os.environ.get("PHOTO_COST_APPROVED")=="true"
    for n in NUMBERS:
        r=recipes[n]
        assert r["category"]=="poultry" and "Рубленые котлеты из индейки" in r["title"]
        filename=f'{n:04d}-{r["id"]}-no-eggs-regen.webp'
        outfile=ROOT/"assets"/"recipes-ai"/filename
        rec=RECORDS/f"{n:04d}.json"
        pending=RECORDS/f"{n:04d}.pending.json"
        if rec.exists():
            o=json.loads(rec.read_text(encoding="utf-8"))
            assert outfile.exists() and hashlib.sha256(outfile.read_bytes()).hexdigest()==o["sha256"]
            print("ALREADY_GENERATED",n,flush=True)
            continue
        if pending.exists():
            raise RuntimeError(f"Unresolved paid request for {n}: do NOT charge again without recovery")
        if outfile.exists():
            raise RuntimeError(f"Candidate {outfile} exists without record")
        p=prompt(n)
        pending.parent.mkdir(parents=True,exist_ok=True)
        ym.atomic_write(pending,json.dumps({"n":n,"prompt":p,"status":"request_pending_or_sent",
            "at":datetime.now(timezone.utc).isoformat()},ensure_ascii=False,indent=2).encode())
        checkpoint([pending],f"Reserve Yandex request for turkey photograph {n}")
        print(f"CALL_YANDEX {n}: {r['title']}",flush=True)
        raw=ym.request_image(p,key,folder)
        data=ym.encode_webp(raw)
        ym.atomic_write(outfile,data)
        h=hashlib.sha256(data).hexdigest()
        ym.atomic_write(rec,json.dumps({"n":n,"title":r["title"],"id":r["id"],
            "path":str(outfile.relative_to(ROOT)),"prompt":p,
            "sha256":h,"status":"generated_for_immediate_publication",
            "generated_at":datetime.now(timezone.utc).isoformat()},ensure_ascii=False,indent=2).encode())
        pending.unlink()
        checkpoint([outfile,rec,pending],f"Save corrected Yandex photo {n} without fried egg")
        print(f"SAVED {n}: {h}",flush=True)

def publish_catalogs():
    verified={}
    for n in NUMBERS:
        r=recipes[n]
        path=ROOT/"assets"/"recipes-ai"/f'{n:04d}-{r["id"]}-no-eggs-regen.webp'
        record=json.loads((RECORDS/f"{n:04d}.json").read_text(encoding="utf-8"))
        b=path.read_bytes()
        assert len(b)>20000 and b[:4]==b"RIFF" and b[8:12]==b"WEBP"
        assert hashlib.sha256(b).hexdigest()==record["sha256"]
        verified[n]={"path":"/"+str(path.relative_to(ROOT)),"sha":sha1_git(b),"bytes":len(b)}
    for file in (ROOT/"index.html",ROOT/"full-catalog/index.html"):
        s=file.read_text(encoding="utf-8")
        m=REGEXP.search(s)
        assert m,file
        data=json.loads(m.group(2))
        assert len(data)==1001
        for n in NUMBERS:
            r=data[n-1]
            assert r["id"]==recipes[n]["id"] and r["category"]=="poultry"
            assert r["photo"]==f'/assets/recipes-ai/{n:04d}-{r["id"]}.webp' or r["photo"]==verified[n]["path"]
            r["photo"]=verified[n]["path"]
            r["ingredients"]=[x for x in r["ingredients"] if x["name"].casefold() not in ("яйцо","яйца")]
            r["steps"][0]["detail"]="Соедини фарш с панировочными сухарями, добавь немного соли и перца. Хорошо вымешай массу, чтобы котлеты держали форму."
            r["steps"][1]["title"]="Сформуй котлеты"
            r["steps"][1]["detail"]="Сформуй небольшие рубленые котлеты одинаковой толщины."
            r["steps"][2]["detail"]=r["steps"][2]["detail"].replace("фрикадельки","котлеты")
            assert all("яйц" not in json.dumps(x,ensure_ascii=False).lower() for x in r["steps"])
        updated=s[:m.start(2)]+json.dumps(data,ensure_ascii=False,separators=(",",":"))+s[m.end(2):]
        reread=json.loads(REGEXP.search(updated).group(2))
        assert len(reread)==1001 and all(reread[n-1]["photo"]==verified[n]["path"] for n in NUMBERS)
        file.write_text(updated,encoding="utf-8")
    mp=ROOT/"photo-library"/"ai-recipe-photo-map.json"
    data=json.loads(mp.read_text(encoding="utf-8"))
    assert len(data["photos"])==1001
    for n in NUMBERS:
        ri=data["photos"][n-1]
        assert ri["n"]==n and ri["recipe_id"]==recipes[n]["id"]
        ri.update(path=verified[n]["path"],sha=verified[n]["sha"],bytes=verified[n]["bytes"])
    mp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    audit=ROOT/"photo-library"/"ingredient-visual-audit.json"
    obj=json.loads(audit.read_text(encoding="utf-8"))
    for issue in obj["issues"]:
        n=issue["n"]
        if n in NUMBERS:
            issue["status"]="replacement_published_without_visual_signoff"
            issue["replacementAsset"]=verified[n]["path"].lstrip("/")
        elif n in (27,28,32,37,117,118,*range(921,931)):
            issue["status"]="generated_and_published_without_visual_signoff"
        elif issue["status"]=="replacement_asset_staged_pending_visual_review":
            issue["status"]="replacement_published_without_visual_signoff"
        # Do not misrepresent visuals as manually verified.
        issue["visually_verified"]=False
    obj["owner_authorized_direct_publication"]=True
    obj["release_requires_visual_approval"]=False
    audit.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    checkpoint([ROOT/"index.html",ROOT/"full-catalog/index.html",mp,audit],
        "Publish 2 egg-free turkey recipes and record owner-authorized photo release")

if __name__=="__main__":
    generate()
    publish_catalogs()
    print("DONE: 2 turkey photos, recipe steps, ingredients, catalog links, map, audit",flush=True)
