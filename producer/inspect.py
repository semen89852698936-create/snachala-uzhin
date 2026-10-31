#!/usr/bin/env python3
"""Read-only project inspector. No content changes, no deployments, no secret access."""
import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path

root=Path(__file__).resolve().parent.parent
photo=root/"photo-library"
report={"generated_at":datetime.now(timezone.utc).isoformat(),
        "project":"snachala-uzhin",
        "mode":"read_only_audit",
        "production_changes":False,
        "checks":{},"next_actions":[]}
registry=photo/"recipes-photo-registry.csv"
if registry.exists():
    with registry.open(encoding="utf-8-sig",newline="") as f:
        rows=list(csv.DictReader(f))
    ids=[r.get("recipe_id","") for r in rows]
    report["checks"]["recipes"]={"count":len(ids),"unique":len(set(ids)),
                                    "valid":len(ids)==1001 and len(set(ids))==1001}
else:
    report["checks"]["recipes"]={"valid":False,"reason":"missing_registry"}
curated=photo/"curated-images.json"
if curated.exists():
    items=json.loads(curated.read_text(encoding="utf-8"))
    present=sum(bool(x.get("image_path")) and (photo/x["image_path"]).is_file()
                for x in items)
    verified=sum(bool(x.get("visual_verified")) and bool(x.get("rights_verified"))
                 and bool(x.get("image_path")) and (photo/x["image_path"]).is_file()
                 for x in items)
    report["checks"]["photographs"]={"curated_entries":len(items),
                                      "files_present":present,"verified_candidates":verified}
    if verified < 1001:
        report["next_actions"].append("Collect and visually verify recipe-specific photo assets")
else:
    report["checks"]["photographs"]={"curated_entries":0,"reason":"missing_curated_ledger"}
report["checks"]["recipe_page_present"]=(root/"index.html").is_file()
report["checks"]["our_evening_present"]=(root/"nashe-vecher.html").is_file()
out=root/"producer"/"report.json"
out.parent.mkdir(exist_ok=True,parents=True)
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report["checks"].get("recipes",{}).get("valid"):
    raise SystemExit("Photo registry validation failed")
