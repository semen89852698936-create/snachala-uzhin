#!/usr/bin/env python3
"""Generate six owner-authorized Yandex AI air-fryer photo candidates.

Only writes to a separate candidate folder on this branch. Never updates the
1001-recipe catalog, never publishes images, and never retries uncertain paid
requests. Physical appliance tests remain NOT TESTED.
"""
from __future__ import annotations
import argparse, hashlib, importlib.util, json, os, subprocess
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "airfryer-editorial-candidates.json"
SOURCE = ROOT / "_photo_source" / "photo-pipeline" / "generate_yandexart.py"
DEST = ROOT / "photo-library" / "airfryer-six-20261107"
EXPECTED_BRANCH = "photo-production/airfryer-six-candidates-20261107"

PROMPTS = {
 "af-salmon-lemon-herbs-2": "Фотореалистичная премиальная фуд-фотография готового блюда на двоих: два отдельных филе лосося примерно по 130 г, золотистые края и натуральная слоистая текстура готовой рыбы, немного укропа, долька лимона и лёгкий блеск оливкового масла. Светлая керамическая тарелка, тёплый мягкий ресторанный свет, крупный план. Без сливочного соуса, гриль-полос, сырой прозрачной середины, людей и текста.",
 "af-chicken-paprika-2": "Фотореалистичная премиальная фуд-фотография готового блюда на двоих: два филе куриной грудки с ровной золотистой корочкой сладкой паприки и чеснока, одно филе слегка разрезано, внутри полностью приготовленная сочная белая мякоть. Без панировки, костей, крылышек, яиц и розовой сырой середины. Светлая керамика, тёплый мягкий ресторанный свет, крупный план, без людей и текста.",
 "af-potato-wedges-2": "Фотореалистичная премиальная фуд-фотография картофельных долек с кожицей, приготовленных в аэрогриле: румяная сухая хрустящая корочка, копчёная паприка и орегано, натуральный золотистый цвет, две небольшие порции на керамической тарелке. Без картофеля фри соломкой, сыра, кетчупа, мяса и подгорания. Тёплый мягкий ресторанный свет, крупный план, без людей и текста.",
 "af-brussels-lemon-2": "Фотореалистичная премиальная фуд-фотография готовой брюссельской капусты: целые и разрезанные пополам кочанчики, мягкие золотистые подрумяненные края без обугливания, свежая лимонная цедра и лёгкий блеск оливкового масла. Подача на двоих на светлой керамике. Не брокколи, без бекона, сливок и сыра. Тёплый мягкий ресторанный свет, крупный план, без людей и текста.",
 "af-mushrooms-thyme-toast-2": "Фотореалистичная премиальная фуд-фотография двух отдельных хрустящих тостов на закваске, щедро покрытых золотистыми коричневыми шампиньонами с тимьяном, чесноком и небольшим количеством свежей петрушки. Грибы блестящие, поджаренные, без лишней жидкости. Без сливочного соуса, яйца пашот и сыра. Светлая керамика, тёплый ресторанный свет, крупный план, без людей и текста.",
 "af-carrots-maple-thyme-2": "Фотореалистичная премиальная фуд-фотография запечённой моркови, разрезанной вдоль, с тонкой блестящей кленовой глазурью, листочками тимьяна и умеренной карамелизацией. Морковь мягкая, края золотистые, сахар не подгорел. Подача на двоих на светлой керамике. Без мёда, сыра и мяса. Тёплый мягкий ресторанный свет, крупный план, без людей и текста."
}

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def git(*args):
    subprocess.run(["git", *args], cwd=ROOT, check=True)

def commit_push(paths, message):
    for path in paths:
        git("add", "-A", str(path.relative_to(ROOT)))
    if subprocess.run(["git","diff","--cached","--quiet"],cwd=ROOT).returncode:
        return
    git("commit","-m",message)
    branch=os.environ.get("GITHUB_REF_NAME","")
    if branch != EXPECTED_BRANCH:
        raise RuntimeError(f"Refusing to push outside {EXPECTED_BRANCH}: {branch}")
    git("push","origin",f"HEAD:refs/heads/{branch}")

def load_yandex():
    spec=importlib.util.spec_from_file_location("yandex_art",SOURCE)
    assert spec and spec.loader, "Yandex generator source missing"
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def load_candidates():
    data=json.loads(DATA.read_text(encoding="utf-8"))
    assert len(data["recipes"])==6
    assert data["source_review"]["status"]=="cross_checked"
    ids={r["id"] for r in data["recipes"]}
    assert ids==set(PROMPTS), f"Prompt/candidate IDs mismatch: {ids ^ set(PROMPTS)}"
    for recipe in data["recipes"]:
        assert recipe["source_verification"]["status"]=="cross_checked"
        assert recipe["appliance_test"]["status"]=="not_tested"
        assert recipe["photo_status"]=="required" and recipe["photo_webp"] is None
        assert len(PROMPTS[recipe["id"]])<=500, (recipe["id"],len(PROMPTS[recipe["id"]]))
    return data["recipes"]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--execute",action="store_true")
    args=parser.parse_args()
    recipes=load_candidates()
    for recipe in recipes:
        print(json.dumps({
          "id":recipe["id"],"title":recipe["title"],
          "prompt":PROMPTS[recipe["id"]],
          "prompt_length":len(PROMPTS[recipe["id"]]),
          "mode":"paid-candidate" if args.execute else "dry-run"
        },ensure_ascii=False))
    if not args.execute:
        print("DRY_RUN_ONLY: six prompts validated; no paid calls and no files changed.")
        return
    if os.getenv("PHOTO_COST_APPROVED")!="true":
        raise RuntimeError("PHOTO_COST_APPROVED=true required")
    if not os.getenv("YANDEX_API_KEY") or not os.getenv("YANDEX_FOLDER_ID"):
        raise RuntimeError("YANDEX_API_KEY and YANDEX_FOLDER_ID are required")
    if os.getenv("GITHUB_REF_NAME")!=EXPECTED_BRANCH:
        raise RuntimeError("Paid generation is allowed only on the dedicated candidate branch")
    ym=load_yandex()
    made=skipped=0
    for recipe in recipes:
        rid=recipe["id"]
        stem=f"{recipe['id']}"
        out=DEST/"candidates"/f"{stem}.webp"
        record=DEST/"records"/f"{stem}.json"
        pending=DEST/"pending"/f"{stem}.json"
        raw_path=DEST/"raw-checkpoint"/f"{stem}.png"
        rejected=DEST/"rejected"/f"{stem}.json"
        if out.is_file() and record.is_file():
            meta=json.loads(record.read_text(encoding="utf-8"))
            with open(out,"rb") as f: blob=f.read()
            assert hashlib.sha256(blob).hexdigest()==meta["sha256"], f"Hash mismatch: {rid}"
            assert blob[:4]==b"RIFF" and blob[8:12]==b"WEBP"
            skipped+=1
            print(f"SKIP_VERIFIED {rid}",flush=True)
            continue
        if out.exists()!=record.exists():
            raise RuntimeError(f"Partial candidate record for {rid}; manual recovery required")
        if rejected.exists():
            print(f"SKIP_REFUSED {rid}",flush=True)
            continue
        if pending.exists() and not raw_path.exists():
            raise RuntimeError(f"Uncertain paid request for {rid}; never repeat automatically")
        if pending.exists() and raw_path.exists():
            raw=raw_path.read_bytes()
            print(f"RECOVER_PAID_RAW {rid}",flush=True)
        else:
            pending.parent.mkdir(parents=True,exist_ok=True)
            ym.atomic_write(pending,json.dumps({
              "id":rid,"status":"request_pending_or_sent",
              "prompt":PROMPTS[rid],"reserved_at":now(),
              "note":"Do not repeat this paid request if raw checkpoint is absent."
            },ensure_ascii=False,indent=2).encode())
            commit_push([pending],"Reserve one Yandex AI airfryer photo request")
            try:
                raw=ym.request_image(PROMPTS[rid],os.environ["YANDEX_API_KEY"],os.environ["YANDEX_FOLDER_ID"])
            except ym.ModelImageRefusal as exc:
                rejected.parent.mkdir(parents=True,exist_ok=True)
                ym.atomic_write(rejected,json.dumps({
                  "id":rid,"status":"refused_by_model","prompt":PROMPTS[rid],
                  "reason":str(exc),"recorded_at":now(),"owner_review_required":True
                },ensure_ascii=False,indent=2).encode())
                pending.unlink(missing_ok=True)
                commit_push([pending,rejected],"Archive Yandex refusal for airfryer image candidate")
                print(f"MODEL_REFUSAL {rid}",flush=True)
                continue
            raw_path.parent.mkdir(parents=True,exist_ok=True)
            ym.atomic_write(raw_path,raw)
            commit_push([raw_path],"Checkpoint paid Yandex airfryer image response")
        webp=ym.encode_webp(raw)
        assert len(webp)>20000 and webp[:4]==b"RIFF" and webp[8:12]==b"WEBP"
        out.parent.mkdir(parents=True,exist_ok=True)
        ym.atomic_write(out,webp)
        meta={
          "id":rid,"title":recipe["title"],"ingredients":recipe["ingredients"],
          "candidate_path":str(out.relative_to(ROOT)),
          "bytes":len(webp),"sha256":hashlib.sha256(webp).hexdigest(),
          "size":[1200,900],"model":"aliceai-image-art-3.0",
          "prompt":PROMPTS[rid],"generated_at":now(),
          "status":"generated_candidate_not_published",
          "visually_verified":False,"appliance_test":"not_tested"
        }
        record.parent.mkdir(parents=True,exist_ok=True)
        ym.atomic_write(record,json.dumps(meta,ensure_ascii=False,indent=2).encode())
        pending.unlink(missing_ok=True)
        raw_path.unlink(missing_ok=True)
        commit_push([out,record,pending,raw_path],"Save Yandex AI airfryer photo candidate")
        made+=1
        print(f"CANDIDATE_READY {rid} sha256={meta['sha256']} bytes={len(webp)}",flush=True)
    print(json.dumps({"generated":made,"already_saved":skipped,"total":len(recipes)},ensure_ascii=False))
if __name__=="__main__":
    main()
