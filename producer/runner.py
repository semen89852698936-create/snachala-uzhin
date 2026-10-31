#!/usr/bin/env python3
"""Safe deterministic task runner. No external commands, LLM calls, or writes to product files."""
import json
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent.parent
tasks=json.loads((ROOT/"producer/tasks.json").read_text(encoding="utf-8"))["tasks"]
allowed={"photo-catalog-integrity","photo-library-progress","our-evening-present"}
assert len(tasks)<=20 and len({t["id"] for t in tasks})==len(tasks)
results=[]
for task in sorted(tasks,key=lambda t:t["priority"]):
    assert task["id"] in allowed and task["type"]=="audit"
    if not task["enabled"]: continue
    if task["id"]=="photo-catalog-integrity":
        summary=json.loads((ROOT/"photo-library/summary.json").read_text(encoding="utf-8"))
        ok=summary["total_recipes"]==1001 and summary["unique_ids"]==1001
        info={"recipes":summary["total_recipes"]}
    elif task["id"]=="photo-library-progress":
        records=json.loads((ROOT/"photo-library/curated-images.json").read_text(encoding="utf-8"))
        ok=True
        info={"curated_entries":len(records),"goal":1001}
    else:
        ok=(ROOT/"nashe-vecher.html").is_file()
        info={"page_exists":ok}
    results.append({"id":task["id"],"ok":ok,"details":info})
report={"timestamp_utc":datetime.now(timezone.utc).isoformat(),"read_only":True,"results":results,"all_checks_passed":all(r["ok"] for r in results)}
path=ROOT/"producer/runner-report.json"
path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report["all_checks_passed"]: raise SystemExit(1)
