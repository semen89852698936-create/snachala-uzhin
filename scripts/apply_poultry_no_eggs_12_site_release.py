#!/usr/bin/env python3
"""Attach 12 no-egg Yandex poultry images and remove eggs from both recipe catalogs.

No paid calls, no production deployment; preserves the original 1001 pictures.
"""
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE_COMMIT="3c855cd3f6fefe7022244350ca2c72c5b3495b40"
SOURCE_ROOT="photo-library/poultry-no-eggs-regeneration-20261103"
QUEUE="photo-library/poultry-no-eggs-regeneration-queue-20261103.json"
IDS=(147,148,149,150,151,153,155,156,168,169,173,176)
MAP=ROOT/"photo-library/ai-recipe-photo-map.json"
HTML=(ROOT/"index.html",ROOT/"full-catalog/index.html")
REPORT=ROOT/"photo-library/poultry-no-eggs-12-site-release-20261103.json"
SCRIPT=re.compile(r'(<script id="recipeData" type="application/json">)(.*?)(</script>)', re.S)

def git_bytes(path):
    return subprocess.check_output(["git","show",f"{SOURCE_COMMIT}:{path}"],cwd=ROOT)

def git_sha(blob):
    return hashlib.sha1(b"blob "+str(len(blob)).encode()+b"\0"+blob).hexdigest()

def compact(obj):
    return json.dumps(obj,ensure_ascii=False,separators=(",",":"))

def edit_recipe(recipe, item):
    assert recipe["id"]==item["id"] and recipe["category"]=="poultry"
    before=compact(recipe)
    old=recipe["ingredients"]
    egg=[x for x in old if x["name"].casefold() in ("яйцо","яйца")]
    assert len(egg)==1 and egg[0]["amount"]==1
    recipe["ingredients"]=[x for x in old if x not in egg]
    assert [x["name"] for x in recipe["ingredients"]]==item["ingredients"]
    steps=recipe["steps"]
    assert "Соедини фарш с яйцом и сухарями" in steps[0]["detail"]
    binder="Соедини фарш с панировочными сухарями, добавь немного соли и перца. Хорошо вымешай массу, чтобы котлеты держали форму." if item["n"]<=156 else "Соедини куриный фарш с панировочными сухарями, добавь немного соли и перца. Хорошо вымешай массу, чтобы фрикадельки держали форму."
    steps[0]["detail"]=binder
    if item["n"]<=156:
        assert steps[1]["title"]=="Сформуй шарики"
        steps[1]["title"]="Сформуй котлеты"
        steps[1]["detail"]="Сформуй небольшие рубленые котлеты одинаковой толщины."
        assert "фрикадельки" in steps[2]["detail"]
        steps[2]["detail"]=steps[2]["detail"].replace("фрикадельки","котлеты")
    assert not any("яйц" in compact(x).casefold() or "яйцо" in compact(x).casefold() for x in recipe["ingredients"])
    assert "яйц" not in compact(recipe["steps"]).casefold() and "яйцо" not in compact(recipe["steps"]).casefold()
    return before,compact(recipe)

def run():
    queue=json.loads(git_bytes(QUEUE))
    items=queue["recipes"]
    assert tuple(int(x["n"]) for x in items)==IDS and len(items)==queue["count"]==12
    source_map=json.loads(MAP.read_text(encoding="utf8"))
    assert len(source_map["photos"])==1001
    changes=[]
    for item in items:
        n=int(item["n"]);ri=source_map["photos"][n-1];rid=item["id"]
        assert ri["n"]==n and ri["recipe_id"]==rid
        assert item["status"]=="queued" and not item["approved_for_publication"]
        assert "Яйцо" not in item["ingredients"]
        source_file=item["output_file"]
        blob=git_bytes(f"{SOURCE_ROOT}/photos/{source_file}")
        record=json.loads(git_bytes(f"{SOURCE_ROOT}/records/{source_file[:-5]}.json"))
        assert record["n"]==n and record["recipe_id"]==rid
        assert record["status"]=="generated_candidate_unpublished" and record["approved_for_publication"] is False
        assert record["sha256"]==hashlib.sha256(blob).hexdigest()
        assert record["bytes"]==len(blob) and len(blob)>20000
        assert blob[:4]==b"RIFF" and blob[8:12]==b"WEBP"
        old=ri["path"]
        assert old==item["existing_live_path"]
        new=f"/assets/recipes-ai/{source_file}"
        dest=ROOT/new.lstrip("/")
        assert not dest.exists()
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(blob)
        ri.update(path=new,sha=git_sha(blob),bytes=len(blob))
        changes.append({"n":n,"recipe_id":rid,"original_path":old,"new_path":new,"bytes":len(blob),"sha":ri["sha"]})
    for page in HTML:
        text=page.read_text(encoding="utf8")
        match=SCRIPT.search(text)
        assert match, page
        recipe_data=json.loads(match.group(2))
        assert len(recipe_data)==1001
        raw=match.group(2)
        for item,change in zip(items,changes):
            r=recipe_data[int(item["n"])-1]
            old,new=edit_recipe(r,item)
            assert raw.count(old)==1,(page,item["n"],"recipe json source")
            assert old.count(change["original_path"])==1
            new=new.replace(change["original_path"],change["new_path"])
            assert new.count(change["new_path"])==1
            raw=raw.replace(old,new,1)
        updated=text[:match.start(2)]+raw+text[match.end(2):]
        check=SCRIPT.search(updated)
        j=json.loads(check.group(2))
        assert len(j)==1001
        for item,change in zip(items,changes):
            r=j[int(item["n"])-1]
            assert r["photo"]==change["new_path"]
            assert not any("яйц" in x["name"].lower() or "яйцо" in x["name"].lower() for x in r["ingredients"])
            assert all("яйц" not in x["detail"].lower() and "яйцо" not in x["detail"].lower() for x in r["steps"])
        page.write_text(updated,encoding="utf8")
    MAP.write_text(json.dumps(source_map,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    REPORT.write_text(json.dumps({
        "schema_version":1,"date":"2026-11-03","owner_requested_egg_removal":True,
        "source_commit":SOURCE_COMMIT,"photo_count":12,
        "originals_preserved":True,"catalogs_updated":2,
        "instructions_updated":True,
        "editorial_note":"Directly viewed generated 12 WebPs; confirm accurate culinary shape during visual approval",
        "replacements":changes
    },ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("PASS 12 poultry photo candidates, removed egg from exact 12 ingredient lists and cooking instructions in both catalogs")

if __name__=="__main__":
    run()
