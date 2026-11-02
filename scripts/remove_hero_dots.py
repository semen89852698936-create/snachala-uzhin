#!/usr/bin/env python3
"""Remove just the two owner-requested punctuation marks from the main hero."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT / "index.html", ROOT / "full-catalog/index.html"]
REPLACEMENTS = {
    "<h1 id=\"du-hero-title\">Сначала<br><i>ужин.</i><span class=\"du-h1-dot\">♡</span></h1>":
    "<h1 id=\"du-hero-title\">Сначала<br><i>ужин</i><span class=\"du-h1-dot\">♡</span></h1>",
    "<p class=\"du-hero-slogan\">1001 повод <em>остаться.</em></p>":
    "<p class=\"du-hero-slogan\">1001 повод <em>остаться</em></p>"
}

for file in FILES:
    source = file.read_text(encoding="utf-8")
    revised = source
    for old, new in REPLACEMENTS.items():
        count = revised.count(old)
        if count != 1:
            raise ValueError(f"{file}: expected exactly one occurrence of {old!r}, got {count}")
        revised = revised.replace(old, new, 1)
    if revised == source:
        raise ValueError(f"No change applied: {file}")
    assert "<h1 id=\"du-hero-title\">Сначала<br><i>ужин</i><span class=\"du-h1-dot\">♡</span></h1>" in revised
    assert "<p class=\"du-hero-slogan\">1001 повод <em>остаться</em></p>" in revised
    file.write_text(revised, encoding="utf-8")
    print(f"PASS {file.relative_to(ROOT)}: removed 2 dots without changing other text")
