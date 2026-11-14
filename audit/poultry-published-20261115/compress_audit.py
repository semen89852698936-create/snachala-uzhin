#!/usr/bin/env python3
"""Lossy inspection copies only; original photos and full contact sheets stay unchanged."""
from pathlib import Path
from PIL import Image
base=Path("audit/poultry-published-20261115")
saved=[]
for p in [*(base.glob("poultry-photos-*.jpg")),*(base.glob("live-poultry-*.png"))]:
    with Image.open(p) as im:
        im=im.convert("RGB")
        im.thumbnail((1520,1800),Image.Resampling.LANCZOS)
        dest=base/(p.stem+"-compact.jpg")
        im.save(dest,"JPEG",quality=61,optimize=True,subsampling=2)
    saved.append((str(dest),dest.stat().st_size))
print(saved)
assert len(saved)==9, f"Expected 5 contact sheets and 4 browser screenshots; have {len(saved)}"
assert all(sz<930_000 for _,sz in saved), "Inspection JPEG > GitHub API limit"
