#!/usr/bin/env python3
"""Regression checks for the isolated, payment-free SNAСHALA UZHIN landing page."""
from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "landing.html"
MAIN = ROOT / "index.html"

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids: list[str] = []
        self.links: list[dict] = []
        self.images: list[dict] = []
        self.metas: list[dict] = []
        self.html_lang: str | None = None
        self.h1 = 0
        self.vinyl_card_count = 0

    def handle_starttag(self, tag: str, attrs):
        d = dict(attrs)
        if "id" in d:
            self.ids.append(d["id"])
        if tag == "html":
            self.html_lang = d.get("lang")
        if tag == "img":
            self.images.append(d)
        if tag == "a":
            self.links.append(d)
            if "vinyl-card" in d.get("class", "").split():
                self.vinyl_card_count += 1
        if tag == "meta":
            self.metas.append(d)
        if tag == "h1":
            self.h1 += 1

page_text = PAGE.read_text(encoding="utf-8")
main_text = MAIN.read_text(encoding="utf-8")
page = PageParser()
page.feed(page_text)

assert page.html_lang == "ru", "Landing must use Russian locale"
assert page.h1 == 1, "Sales page must have exactly one H1"
assert len(page.ids) == len(set(page.ids)), "Duplicate anchor ID"
assert len(page.images) == 5, "Five distinct existing product photos are expected"
assert page.vinyl_card_count == 3, "Three distinct BPM music cards"
assert any(m.get("name") == "viewport" for m in page.metas), "No mobile viewport"
assert any(m.get("name") == "robots" and "noindex" in m.get("content", "") for m in page.metas), "Draft marketing page must not index yet"

for img in page.images:
    src, alt = img.get("src", ""), img.get("alt", "")
    assert src.startswith("/assets/"), f"Only approved product assets can be used: {src}"
    assert (ROOT / src.lstrip("/")).is_file(), f"Missing landing photo: {src}"
    assert len(alt) >= 18, f"Image needs descriptive alt text: {src}"
    assert img.get("loading") == "lazy" or img.get("fetchpriority") == "high", f"Provide image priority: {src}"

paths = [image["src"] for image in page.images]
assert len(paths) == len(set(paths)), "Do not repeat photos on the landing"
assert "/assets/our-evening-together-approved.webp" in paths, "Only approved hero photo"
assert "1000 РЕЦЕПТОВ + 1 СЕКРЕТНЫЙ" in page_text
assert "10" in page_text and "1001" in page_text
assert "Готовьте вместе." in page_text and "Остальное... без рецепта." in page_text
assert page_text.count("1 900 ₽") >= 2, "Owner-approved opening price must be visible in offer and FAQ"
assert 'id="price"' in page_text and 'Стоимость на старте' in page_text
assert "Оплата будет доступна после запуска продаж." in page_text
assert "120 BPM И ВЫШЕ" in page_text and "80 BPM И НИЖЕ" in page_text
assert "80–100 BPM" in page_text

for item in page.links:
    href = unquote(item.get("href", ""))
    if href.startswith("#"):
        assert href[1:] in page.ids, f"Broken in-page link: {href}"
    elif href.startswith("/#"):
        frag = href[2:]
        if frag.startswith("recipe="):
            match = re.search(r'<script id="recipeData" type="application/json">(.*?)</script>', main_text, re.S)
            assert match
            recipes = json.loads(match.group(1))
            assert frag[7:] in {r["id"] for r in recipes}, f"Missing recipe {frag}"
        else:
            assert f'id="{frag}"' in main_text, f"Missing anchor on existing site: {href}"
    else:
        assert href == "/", f"Unreviewed external or fake checkout link: {href}"

assert "checkout" not in page_text.casefold()
assert "images.unsplash.com" not in page_text.casefold()
assert not re.search(r'<script(?:\s|>)', page_text, re.I), "Marketing draft must remain static"
print(f"PASS: responsive concept, {page.h1} heading, {len(page.links)} valid internal routes, "
      f"{len(page.images)} distinct local photos, 3 BPM cards, no fictitious payments")
