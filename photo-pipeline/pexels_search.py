#!/usr/bin/env python3
"""Pexels discovery queue. Records candidates only, never auto-publishes or purchases."""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

API="https://api.pexels.com/v1/search"

def atomic_json(path, payload):
    path=Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(".json.tmp")
    temp.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    temp.replace(path)

def api_candidates(query,key,per_page=12):
    params=urlencode({"query":query,"locale":"ru-RU","per_page":per_page,"page":1})
    req=Request(API+"?"+params,headers={"Authorization":key},method="GET")
    with urlopen(req,timeout=60) as resp:
        payload=json.load(resp)
        remaining=resp.headers.get("X-Ratelimit-Remaining")
    photos=[]
    for p in payload.get("photos",[]):
        url=p.get("url","")
        if not url.startswith("https://www.pexels.com/photo/"):
            continue
        if p.get("width",0)<1000 or p.get("height",0)<700:
            continue
        src=p.get("src") or {}
        thumb=src.get("medium")
        if not thumb or not thumb.startswith("https://images.pexels.com/"):
            continue
        photos.append({
            "photo_id":p.get("id"),"page_url":url,"photographer":p.get("photographer"),
            "photographer_url":p.get("photographer_url"),"width":p.get("width"),
            "height":p.get("height"),"alt":(p.get("alt") or "")[:400],
            "thumbnail_url":thumb,
            "source":"Pexels","license":"Pexels License",
            "status":"candidate_unreviewed","downloaded":False,"approved":False
        })
    return photos, remaining

def run(args):
    manifest=json.loads(Path(args.manifest).read_text(encoding="utf-8"))["recipes"]
    if len(manifest)!=1001 or len(set(r["id"] for r in manifest))!=1001:
        raise ValueError("Invalid 1001-recipe manifest")
    if not 1<=args.batch_size<=40:
        raise ValueError("batch_size must be 1..40 (to respect API limits)")
    directory=Path(args.output)
    selected=[]
    for r in manifest:
        dest=directory/(r["id"]+".json")
        if dest.exists():
            continue
        selected.append((r,dest))
        if len(selected)>=args.batch_size:
            break
    print("PEXELS_DISCOVERY",json.dumps({"mode":"search" if args.execute else "dry_run",
          "selected":[r["id"] for r,_ in selected],"remaining":len(manifest)-sum(
              (directory/(r["id"]+".json")).exists() for r in manifest
          )},ensure_ascii=False))
    if not args.execute:
        return 0
    key=os.environ.get("PEXELS_API_KEY","")
    if not key:
        raise ValueError("Missing PEXELS_API_KEY in repository secrets")
    for r,dest in selected:
        query=(r["title"][:100]+" готовое блюдо").strip()
        try:
            matches,remaining=api_candidates(query,key)
        except (HTTPError,URLError,ValueError) as exc:
            print("STOP at recipe",r["id"],"error",type(exc).__name__,file=sys.stderr)
            return 1
        atomic_json(dest,{
            "recipe_id":r["id"],"recipe_title":r["title"],"search_query":query,
            "search_date":datetime.now(timezone.utc).isoformat(),
            "candidate_count":len(matches),"candidates":matches,
            "status":"candidate_review_required","source":"Pexels API",
            "review_note":"Page metadata is not visual review. Match exact ingredients and verify license before use."
        })
        print("FOUND",r["id"],len(matches),"Pexels candidates",flush=True)
        if remaining is not None and int(remaining)<=2:
            print("STOP: Pexels API quota nearly exhausted",file=sys.stderr)
            break
        time.sleep(0.25)
    return 0

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--manifest",default="photo-library/recipes.json")
    p.add_argument("--output",default="photo-library/stock-discovery")
    p.add_argument("--batch-size",type=int,default=20)
    p.add_argument("--execute",action="store_true",help="Requires PEXELS_API_KEY, but uses a free Pexels API")
    opts=p.parse_args()
    try:
        return run(opts)
    except (OSError,ValueError,json.JSONDecodeError) as exc:
        print("STOP",type(exc).__name__,str(exc),file=sys.stderr)
        return 1

if __name__=="__main__":
    sys.exit(main())
