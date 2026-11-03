#!/usr/bin/env python3
"""Inspect Russian editorial copy in both HTML variants, without changing them."""
import collections, html, json, re
from pathlib import Path
pages=[Path("index.html"), Path("full-catalog/index.html")]
pat=re.compile(r'(<script id="recipeData" type="application/json">)(.*?)(</script>)',re.S)
head=re.compile(r'<h([1-6])\b([^>]*)>(.*?)</h\1\s*>',re.I|re.S)
strip=re.compile(r'<[^>]+>')
report={"pages":{},"recipe_titles":[],"problematic_templates":[]}
for page in pages:
    s=page.read_text(encoding="utf-8")
    m=pat.search(s)
    assert m
    recipes=json.loads(m.group(2))
    assert len(recipes)==1001
    spotted=[]
    for i,r in enumerate(recipes,1):
        for field,val in [("description",r.get("description",""))]+[(f"steps.{j}.{key}",t.get(key,"")) for j,t in enumerate(r.get("steps",[])) for key in ["title","detail"]]:
            if not isinstance(val,str): continue
            if re.search(r'\b(?:добавь|добавьте)\s+\S+ом\s+и\s+\S+ем\b|\b(?:Яблоком и шалфеем|[А-ЯЁ][а-яё]+ом и [а-яё]+ем) дают блюду\b|\b\d+ шаг[а-я]*\b',val, re.I):
                spotted.append({"n":i,"recipe":r["title"],"field":field,"text":val[:260]})
    headings=[]
    for h in head.finditer(s):
        content=html.unescape(strip.sub("",h.group(3))).strip()
        if content.endswith(".") and not content.endswith("..."):
            headings.append({"tag":"h"+h.group(1),"attrs":h.group(2).strip()[:120],"text":content[:180]})
    report["pages"][str(page)]={
      "bytes":len(s.encode("utf-8")),
      "recipe_count":len(recipes),
      "phrase_counts":{x:s.count(x) for x in ("Добавь яблоком и шалфеем","Яблоком и шалфеем дают блюду свой характер","Ужин готов. А вечер только начинается.","Ужин готов. А вечер только начинается...","Иногда достаточно одного сообщения.","Сначала<br><i>ужин.","1001 повод <em>остаться.","Готовьте вместе. Остальное... без рецепта")},
      "headings_with_period":headings[:120],
      "headings_with_period_count":len(headings),
      "suspicious_recipe_text_count":len(spotted),
      "suspicious_recipe_text_examples":spotted[:100],
      "recipe_first":recipes[0].get("title"),
      "recipe_last":recipes[-1].get("title"),
      "recipe_structure":sorted(recipes[0].keys())
    }
    if str(page)=="index.html": report["problematic_templates"]=spotted[:150]
Path("audit").mkdir(exist_ok=True)
Path("audit/russian-editorial-diagnostics-20261103.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({p:{k:v for k,v in d.items() if k.endswith("_count") or k=="phrase_counts"} for p,d in report["pages"].items()},ensure_ascii=False,indent=2))
