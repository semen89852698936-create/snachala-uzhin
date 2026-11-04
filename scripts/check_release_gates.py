#!/usr/bin/env python3
"""Read-only release gates for the two published HTML entry points.

Run: python3 scripts/check_release_gates.py
No network calls, API keys, payments, or paid photo generation.
This is a static smoke test, not a substitute for browser/payment testing.
"""
from __future__ import annotations
from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
PAGES = (ROOT / "index.html", ROOT / "full-catalog" / "index.html")
REQUIRED = {
    "Список продуктов": "shopping-list header label",
    "Аэрогриль": "air fryer navigation/landing",
    "Мои рецепты": "personal recipes area",
    "Наш вечер": "evening experience",
}
FORBIDDEN = (
    "Песни с указанным темпом · 10",
    "Внешний Spotify-плейлист пока не синхронизирован с этим списком.",
)

class Images(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = []
    def handle_starttag(self, tag, attrs):
        if tag.lower() == "img":
            attrs = dict(attrs)
            if attrs.get("src"):
                self.sources.append(attrs["src"])

def inspect(page: Path) -> list[str]:
    failures = []
    if not page.is_file():
        return [f"{page}: missing HTML entry point"]
    text = page.read_text(encoding="utf-8")
    for marker, purpose in REQUIRED.items():
        if marker not in text:
            failures.append(f"{page}: missing {purpose} ({marker})")
    for marker in FORBIDDEN:
        if marker in text:
            failures.append(f"{page}: obsolete technical copy: {marker}")
    if "<html" not in text.lower() or "</html>" not in text.lower():
        failures.append(f"{page}: incomplete HTML document")
    parser = Images()
    parser.feed(text)
    for src in parser.sources:
        src = src.split("?", 1)[0].split("#", 1)[0]
        if not src or src.startswith(("http:", "https:", "data:", "/", "//", "#")):
            continue
        if "{" in src or "${" in src:
            continue  # runtime-generated path; verified by browser tests
        if not (page.parent / src).resolve().is_file() and not (ROOT / src).resolve().is_file():
            failures.append(f"{page}: missing local image {src}")
    return failures

def main() -> int:
    failures = [problem for page in PAGES for problem in inspect(page)]
    if failures:
        print("FAIL: static release gates")
        for failure in failures:
            print(" -", failure)
        return 1
    print("PASS: static release gates on both HTML versions")
    print("NOT VERIFIED: browser behavior, 1001 photo/recipe consistency, Prodamus, gated paid content, Russia without VPN.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
