#!/usr/bin/env python3
"""No-cost, deterministic inpainting trials on real Alice AI ART WebP photographs.

These are isolated tests, not publication. Keep exact original pixels elsewhere.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "photo-library/regeneration-owner-meat-64-20261113"
DEST = BASE / "inpaint-tests"
DEST.mkdir(parents=True, exist_ok=True)

TESTS = (
    (23, BASE / "revision3/0023-revision3.webp", "large_green_basil_leaves"),
    (54, BASE / "revision4/0054-revision4.webp", "extraneous_yellow_sesame_seeds"),
)

for n, origin, defect in TESTS:
    original = np.array(Image.open(origin).convert("RGB"))
    hsv = cv2.cvtColor(original, cv2.COLOR_RGB2HSV)
    hue, sat, val = cv2.split(hsv)
    height, width = hue.shape

    if n == 23:
        # Large saturated basil leaves on top of cooked-tomato sauce. Removing
        # green leaves must not remove the red tomato ragu or the meat.
        active = (hue >= 30) & (hue <= 96) & (sat >= 55) & (val >= 37)
        mask = np.uint8(active) * 255
        mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    elif n == 54:
        # Small extraneous sesame seeds in soy glaze. Work with compact
        # connected components to avoid masking large natural meat highlights.
        yellow = np.uint8(
            (hue >= 12) & (hue <= 42) & (sat >= 52) & (val >= 130)
        )
        count, labels, stats, _ = cv2.connectedComponentsWithStats(yellow, connectivity=8)
        mask = np.zeros((height, width), dtype=np.uint8)
        for component in range(1, count):
            x, y, w, h, area = map(int, stats[component])
            if (2 <= area <= 150 and y >= 150 and y <= height - 110 and
                x >= 25 and x + w <= width - 25 and 0.12 <= w / max(h, 1) <= 9):
                mask[labels == component] = 255
        mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    else:
        raise AssertionError(n)

    ratio = float(np.mean(mask != 0))
    if not 0.0001 <= ratio <= 0.20:
        raise RuntimeError(f"Suspicious mask coverage for n={n}: {ratio:.4%}")

    for label, mode in (("telea", cv2.INPAINT_TELEA), ("ns", cv2.INPAINT_NS)):
        fixed = cv2.inpaint(original, mask, 5, mode)
        path = DEST / f"{n:04d}-inpaint-{label}.webp"
        Image.fromarray(fixed).save(path, format="WEBP", quality=91, method=6)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        print(f"n={n} {label}: bytes={path.stat().st_size} sha256={digest}", flush=True)

    mask_path = DEST / f"{n:04d}-mask.webp"
    Image.fromarray(mask).save(mask_path, format="WEBP", quality=95, method=5)
    meta = {
        "n": n, "source": str(origin.relative_to(ROOT)),
        "defect": defect, "mask_coverage_fraction": ratio,
        "output_prefix": str((DEST / f"{n:04d}-inpaint").relative_to(ROOT)),
        "status": "visual_test_not_published", "owner_approved": False,
        "method": "OpenCV inpaint, TELEA and Navier-Stokes alternatives",
        "no_external_AI_API_cost": True,
    }
    (DEST / f"{n:04d}-test.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"MASK {n}: {ratio:.3%}", flush=True)

print("DONE: 4 isolated retouched WebP trials, zero production changes")
