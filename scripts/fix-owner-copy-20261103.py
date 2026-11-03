#!/usr/bin/env python3
"""Apply owner-approved Russian copy fixes in both site HTML variants."""
from pathlib import Path
FILES=(Path("index.html"),Path("full-catalog/index.html"))
REPLACEMENTS=[
    ("Яблоком и шалфеем дают блюду свой характер", "Яблоко и шалфей дают блюду свой характер"),
    ("Ужин готов. А вечер только начинается.", "Ужин готов. А вечер только начинается..."),
    ("одного сообщения.", "одного сообщения"),
]
any_changes=False
for path in FILES:
    s=path.read_text(encoding="utf-8")
    original=s
    for before,after in REPLACEMENTS:
        n=s.count(before)
        print(f"{path}: {before!r}: {n} matches")
        s=s.replace(before,after)
    if s!=original:
        path.write_text(s,encoding="utf-8")
        any_changes=True
if not any_changes:
    raise SystemExit("No exact text found: no modifications committed")
