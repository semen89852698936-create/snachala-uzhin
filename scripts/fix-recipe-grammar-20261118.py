#!/usr/bin/env python3
"""Correct verified case errors in imperative recipe step titles only.

All 1001 recipes are validated in both embedded recipeData JSON payloads.
No ingredients, instructions, photos, timers, layout or other content is altered.
"""
import collections
import json
import re
from pathlib import Path

RULES = """
апельсином и кардамоном|апельсин и кардамон
баклажаном и орегано|баклажан и орегано
бананом и корицей|банан и корицу
бананом и орехами|банан и орехи
брокколи и лимоном|брокколи и лимон
вишней и миндалём|вишню и миндаль
вялеными томатами и рукколой|вяленые томаты и рукколу
горошком и мятой|горошек и мяту
горчицей и мёдом|горчицу и мёд
грибами и розмарином|грибы и розмарин
грибами и тимьяном|грибы и тимьян
грушей и орехами|грушу и орехи
имбирём и кунжутом|имбирь и кунжут
имбирём и соевым соусом|имбирь и соевый соус
каперсами и оливками|каперсы и оливки
клюквой и белым шоколадом|клюкву и белый шоколад
кокосом и лаймом|кокос и лайм
лимоном и зеленью|лимон и зелень
лимоном и тимьяном|лимон и тимьян
лимоном и шпинатом|лимон и шпинат
луком и бальзамиком|лук и бальзамик
малиной и ванилью|малину и ваниль
малиной и фисташками|малину и фисташки
манго и кокосом|манго и кокос
паприкой и сладким перцем|паприку и сладкий перец
паприкой и чесноком|паприку и чеснок
пармезаном и гренками|пармезан и гренки
персиком и йогуртом|персик и йогурт
персиком и мёдом|персик и мёд
помидорами и базиликом|помидоры и базилик
сельдереем и укропом|сельдерей и укроп
сладким перцем и паприкой|сладкий перец и паприку
сливками и зелёным перцем|сливки и зелёный перец
сливками и мускатным орехом|сливки и мускатный орех
сливой и корицей|сливу и корицу
томатами и базиликом|томаты и базилик
тыквой и шалфеем|тыкву и шалфей
черникой и лимоном|чернику и лимон
черносливом и тмином|чернослив и тмин
чесноком и тимьяном|чеснок и тимьян
шоколадом и апельсином|шоколад и апельсин
шпинатом и чесноком|шпинат и чеснок
яблоком и корицей|яблоко и корицу
яблоком и мёдом|яблоко и мёд
ягодами и ванилью|ягоды и ваниль
"""
fixes = dict(
    ("Добавь " + left, "Добавь " + right)
    for line in RULES.strip().splitlines()
    for left, right in [line.split("|", 1)]
)
assert len(fixes) == 45
pat = re.compile(r'(<script id="recipeData" type="application/json">)(.*?)(</script>)', re.S)
pages = [Path("index.html"), Path("full-catalog/index.html")]
before_counts = []
results = []
for page in pages:
    raw = page.read_text(encoding="utf-8")
    match = pat.search(raw)
    assert match, f"{page}: missing recipeData"
    payload = match.group(2)
    recipes = json.loads(payload)
    assert len(recipes) == 1001, (page, len(recipes))
    assert len({r["id"] for r in recipes}) == 1001, page
    changes = []
    title_counter = collections.Counter(
        step.get("title", "")
        for recipe in recipes
        for step in recipe.get("steps", [])
    )
    for old, new in fixes.items():
        n = title_counter[old]
        if not n:
            continue
        source = '"title":' + json.dumps(old, ensure_ascii=False)
        dest = '"title":' + json.dumps(new, ensure_ascii=False)
        assert payload.count(source) == n, (page, old, payload.count(source), n)
        payload = payload.replace(source, dest)
        changes.append((old, new, n))
    assert title_counter["Добавь малиной и ванилью"] == 10, (page, title_counter["Добавь малиной и ванилью"])
    expected = json.loads(match.group(2))
    for recipe in expected:
        for step in recipe.get("steps", []):
            if step.get("title") in fixes:
                step["title"] = fixes[step["title"]]
    actual = json.loads(payload)
    assert actual == expected, f"{page}: unexpected recipe field changed"
    assert all(step.get("title") not in fixes for r in actual for step in r.get("steps", []))
    assert len(actual) == 1001
    newraw = raw[:match.start(2)] + payload + raw[match.end(2):]
    # Only recipeData step-title bytes may differ.
    assert newraw[:match.start(2)] == raw[:match.start(2)]
    assert newraw[-len(raw[match.end(2):]):] == raw[match.end(2):]
    page.write_text(newraw, encoding="utf-8")
    n = sum(c for _, _, c in changes)
    before_counts.append(collections.Counter({old: title_counter[old] for old in fixes}))
    results.append((str(page), n, len(changes)))
    print(f"{page}: 1001 recipes checked, {n} step titles fixed, {len(changes)} erroneous variants")
    for old, new, count in changes:
        print(f"  {count:3d} {old} -> {new}")
assert before_counts[0] == before_counts[1], "The two site variants do not match"
assert results[0][1] > 100, "Unexpectedly few corrections"
print(f"PASS: {results[0][1]} titles corrected per page; 1001 recipes unchanged except step headings")
