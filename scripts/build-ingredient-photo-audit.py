#!/usr/bin/env python3
"""Build a recipe-aware visual inspection queue. Does NOT claim to inspect pixels."""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
recipes = json.loads((ROOT / "photo-library/recipes.json").read_text(encoding="utf-8"))["recipes"]
known = {
 "Свиные отбивные с яблоком и шалфеем": "Нет яблочных долек. Мелко нарезанное обжаренное яблоко с шалфеем отдельно рядом.",
 "Свиные отбивные с черносливом и тмином": "Нет чернослива поверх мяса. Нарезанный тушёный чернослив с тмином в соусе рядом.",
 "Говяжьи медальоны с яблоком и шалфеем": "Нет долек яблока поверх мяса. Горка измельчённого обжаренного яблока с шалфеем рядом.",
 "Говяжьи медальоны с черносливом и тмином": "Нет цельного чернослива сверху. Нарезанный чернослив в соусе.",
 "Свиная вырезка в духовке с яблоком и шалфеем": "Дольки яблока с шалфеем рядом, не сверху мяса.",
 "Свиная вырезка в духовке с паприкой и чесноком": "Нет целых зубчиков чеснока сверху; чеснок в маринаде.",
}
rules = [
 (r"чернослив", "Если чернослив по рецепту нарезается или тушится, не изображать цельным поверх мяса."),
 (r"яблок", "Сверить способ нарезки и точное положение яблока: дольки, мелкие кусочки или смесь; не класть поверх мяса без указания."),
 (r"чеснок", "Если чеснок измельчается или входит в маринад, не изображать целые зубчики сверху."),
 (r"фриттат", "Фриттата представляет собой цельный запечённый омлет, не добавлять глазунью и отдельные желтки сверху."),
]
queue=[]
for r in recipes:
    title=r["title"]
    text=" ".join([title, r.get("description",""),r.get("plating","")])
    flagged=[note for regex,note in rules if re.search(regex,text,re.I)]
    exact=known.get(title)
    if exact or flagged:
        queue.append({"n":r["n"],"id":r["id"],"title":title,
                      "image":f'photo-library/alice-ai-art/photos/{int(r["n"]):04d}-{r["id"]}.webp',
                      "status":"owner_reported_error" if exact else "visual_review_required",
                      "inspection_note":exact or " ".join(flagged),
                      "instructions":r.get("plating",""),
                      "auto_regenerate":False})
present={x["title"] for x in queue}
for title,note in known.items():
    if title not in present:
        print("WARNING known title not exact in recipe manifest:",title)
report={"scope":"1001 recipes", "caution":"Keyword screening of recipe metadata, NOT visual verification of image contents.",
        "auto_generation":False,"queue":queue,"flagged_count":len(queue),
        "owner_reported_matches":sum(x["status"]=="owner_reported_error" for x in queue)}
dest=ROOT/"photo-library/ingredient-visual-audit.json"
dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"recipes":len(recipes),"flagged":len(queue),"owner_reported":report["owner_reported_matches"]},ensure_ascii=False))
