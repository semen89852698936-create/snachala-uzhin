#!/usr/bin/env python3
"""Fetch 100 distinct, license-checked Wikimedia Commons food-photo CANDIDATES.
Photos are NOT automatically approved or published to the site.
Usage: python scripts/build_photo_candidates_21_120.py
"""
from __future__ import annotations
import csv
import hashlib
import html
import io
import json
import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import requests
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "photo-library" / "recipe-photo-registry.csv"
OUTPUT = ROOT / "photo-library" / "candidates-21-120"
OUTPUT.mkdir(parents=True, exist_ok=True)
API = "https://commons.wikimedia.org/w/api.php"
S = requests.Session()
S.headers.update({"User-Agent": "SnachalaUzhinPhotoReview/1.0 (non-commercial preview only; Wikimedia Commons API); python requests"})
SEARCHES = {
    "01": ["beef fillet steak food", "steak plated food", "filet mignon cooked"],
    "02": ["pork tenderloin meal", "roast pork cooked food", "pork fillet food"],
    "03": ["meatballs tomato sauce", "meatballs food", "beef meatballs"],
    "04": ["beef stew food", "beef goulash", "braised beef stew"],
    "05": ["pork medallions meal", "pork fillet restaurant", "pork tenderloin cooked"],
    "06": ["veal cutlet food", "veal schnitzel", "veal escalope"],
    "07": ["lamb stew cooked", "braised lamb meal", "lamb casserole food"],
    "08": ["roast beef cooked", "roast beef sliced", "roast beef dinner"],
    "09": ["beef stir fry", "beef strips cooked", "beef stroganoff food"],
    "10": ["pork chop cooked", "pork cutlet food", "pork chops meal"],
    "poultry": ["chicken breast cooked", "chicken fillet food", "chicken stir fry"],
}
SEARCH_LIMIT = 50
ALLOWED_LICENSE_PREFIXES = ("CC BY", "CC0", "PUBLIC DOMAIN", "PD-", "PDM", "PUBLIC DOMAIN MARK")
DENIED = re.compile(r"(?:CC BY.NC|NON.?COMMERCIAL|ALL RIGHTS RESERVED)", re.I)
BAD_TITLE = re.compile(r"(?:raw|uncooked|butcher|slaughter|animal|diagram|illustrat|cartoon|drawing|engraving|logo|icon|package|packaging|advertisement|menu|sign|beef cattle|cow grazing)", re.I)

def get(url, params=None):
    for attempt in range(4):
        try:
            r = S.get(url, params=params, timeout=35)
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(2 * (attempt + 1))
                continue
            r.raise_for_status()
            return r
        except requests.RequestException:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Could not fetch {url}")

def clean_html(raw):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", raw or ""))).strip()

def meta(i, key):
    d = i.get("extmetadata", {}).get(key) or {}
    return d.get("value", "") if isinstance(d, dict) else ""

def license_ok(name):
    s = clean_html(name).upper()
    return any(s.startswith(x) for x in ALLOWED_LICENSE_PREFIXES) and not DENIED.search(s)

def search(query):
    params = dict(action="query", generator="search",
                  gsrsearch=query, gsrnamespace=6, gsrlimit=SEARCH_LIMIT,
                  prop="imageinfo", iiprop="url|size|mime|extmetadata",
                  iiurlwidth=1200, format="json")
    try:
        result = get(API, params).json()
    except (requests.RequestException, ValueError) as ex:
        print("SEARCH_FAIL", query, ex, flush=True)
        return []
    result = list(result.get("query", {}).get("pages", {}).values())
    items = []
    for page in result:
        info = (page.get("imageinfo") or [{}])[0]
        name = page.get("title", "")
        ext = name.lower().rsplit(".", 1)[-1]
        lic = clean_html(meta(info, "LicenseShortName"))
        url = info.get("thumburl") or info.get("url")
        if BAD_TITLE.search(name) or ext not in ("jpg", "jpeg", "png", "webp"):
            continue
        if not license_ok(lic) or not url:
            continue
        if info.get("width", 0) < 800 or info.get("height", 0) < 600:
            continue
        if info.get("size", 0) > 25_000_000:
            continue
        items.append(dict(pageid=page.get("pageid"), title=name, image_url=url,
                          source_page=info.get("descriptionurl") or
                              ("https://commons.wikimedia.org/wiki/" + name.replace(" ", "_")),
                          author=clean_html(meta(info, "Artist"))[:250],
                          license=lic, license_url=clean_html(meta(info, "LicenseUrl")),
                          description=clean_html(meta(info, "ImageDescription"))[:450],
                          query=query))
    # Prioritize plausible food-photo titles; never call any result an approved visual match.
    items.sort(key=lambda x: (len(x["description"]) < 40,
                              "food" not in (x["title"] + x["description"]).lower()))
    return items

def family(row):
    rid = row["recipe_id"]
    if rid.startswith("collection-poultry"):
        return "poultry"
    m = re.match(r"collection-meat-(\d\d)-", rid)
    if not m:
        raise ValueError("Unexpected recipe type in batch: " + rid)
    return m.group(1)

def make_webp(candidate, destination):
    payload = get(candidate["image_url"]).content
    if len(payload) > 20_000_000:
        raise ValueError("oversized download")
    with Image.open(io.BytesIO(payload)) as source:
        source.load()
        if source.width < 750 or source.height < 550:
            raise ValueError("image below minimum quality")
        im = ImageOps.exif_transpose(source).convert("RGB")
        im = ImageOps.fit(im, (1200, 900), method=Image.Resampling.LANCZOS,
                          centering=(0.5, 0.48))
        im.save(destination, "WEBP", quality=87, method=6)
    with Image.open(destination) as check:
        check.verify()
    data = destination.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data)

def main():
    with REGISTRY.open(encoding="utf-8-sig", newline="") as f:
        all_rows = list(csv.DictReader(f))
    rows = [r for r in all_rows if 21 <= int(r["n"]) <= 120]
    if len(rows) != 100 or len({r["recipe_id"] for r in rows}) != 100:
        raise ValueError("Registry does not contain exactly 100 unique recipes: 21-120")
    by_family = defaultdict(list)
    for row in rows:
        by_family[family(row)].append(row)
    used_ids = set()
    used_hashes = set()
    photos = []
    failures = []
    for kind, items in by_family.items():
        print("GROUP", kind, "RECIPES", len(items), flush=True)
        pool = []
        found = set()
        for q in SEARCHES[kind]:
            for c in search(q):
                if c["pageid"] not in found:
                    pool.append(c)
                    found.add(c["pageid"])
            time.sleep(0.5)
        for row in items:
            n, rid = int(row["n"]), row["recipe_id"]
            file = OUTPUT / f"{n:03d}-{rid}.webp"
            success = False
            for c in pool:
                if c["pageid"] in used_ids:
                    continue
                try:
                    sha, size = make_webp(c, file)
                    if sha in used_hashes:
                        file.unlink(missing_ok=True)
                        continue
                    used_ids.add(c["pageid"])
                    used_hashes.add(sha)
                    photos.append({
                        "n": n, "recipe_id": rid, "recipe_title": row["title"],
                        "file": str(file.relative_to(ROOT)),
                        "sha256": sha, "bytes": size, "dimensions": [1200, 900],
                        "source_page": c["source_page"],
                        "source_image_title": c["title"], "author": c["author"],
                        "license": c["license"], "license_url": c["license_url"],
                        "source_query": c["query"], "source_metadata_checked": True,
                        "visually_reviewed": False, "publication_approved": False,
                        "fit": "unverified_candidate", "site_published": False,
                    })
                    success = True
                    break
                except (requests.RequestException, UnidentifiedImageError, OSError, ValueError) as ex:
                    print("DOWNLOAD_FAIL", c["title"], str(ex)[:100], flush=True)
                    file.unlink(missing_ok=True)
                    # This candidate may still work for another recipe after a transient failure.
                    continue
            if not success:
                failures.append(dict(n=n, recipe_id=rid, title=row["title"],
                                     reason="No downloadable unused source in selected Commons results"))
            print("PROGRESS", len(photos), "of", len(rows), flush=True)
    photos.sort(key=lambda p: p["n"])
    result = {
        "date_utc": datetime.now(timezone.utc).isoformat(),
        "batch": "21-120", "recipes": len(rows),
        "actual_webp_files": len(photos), "missing": len(failures),
        "status": "unreviewed_photo_candidates",
        "IMPORTANT": "Commons search results may not match the exact sauce/ingredients; visually inspect every image before publication.",
        "publication_approved": 0, "photos": photos, "failures": failures,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    summary = ["# Фотокандидаты 21-120 (НЕ ОПУБЛИКОВАНЫ)",
               f"Сохранено отдельных WebP: **{len(photos)} из 100**.",
               "Все фотографии требуют визуальной проверки блюда, точных ингредиентов и качества.",
               "Коммерческое использование проверять по лицензии каждого изображения.",
               "Подписи и лицензии авторов сохранены в manifest.json.", ""]
    for p in photos:
        summary.append(f"- {p['n']:03d}. **{p['recipe_title']}**: [{p['author'] or 'Автор указан на Wikimedia'}]({p['source_page']}) ({p['license']})")
    (OUTPUT / "README.md").write_text("\n".join(summary)+"\n", encoding="utf-8")
    print("DONE", len(photos), "failed", len(failures), flush=True)
    if failures:
        print("NOTE: Only existing images counted; no fake 100% completion.", flush=True)

if __name__ == "__main__":
    main()
