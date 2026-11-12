#!/usr/bin/env python3
"""Activate 15 Dark Antey tracks ONLY when all MP3 bytes are in the Git checkout.

The tool only changes the manifest and credits after SHA-256 and file presence pass.
Run on a feature branch, never from a production website. It is idempotent.
"""
import hashlib
import json
import re
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "music" / "dark-antey-silent-depths-staging-20261112.json"
MANIFEST = ROOT / "music" / "native-player-manifest.json"
CREDITS = ROOT / "music" / "credits.html"
NAMES = {
    "kitchen": "Под что готовить",
    "dinner": "Под что ужинать",
    "after": "Под что продолжить",
}


def main():
    draft = json.loads(STAGE.read_text(encoding="utf-8"))
    tracks = draft["tracks"]
    if len(tracks) != 15 or len({t["id"] for t in tracks}) != 15:
        raise ValueError("Expected exactly 15 unique original tracks")
    for t in tracks:
        src = t["src"]
        if not src.startswith("/assets/music/dark-antey/") or not src.endswith(".mp3"):
            raise ValueError("Unexpected src path for " + t["id"])
        path = ROOT / src.lstrip("/")
        if not path.is_file():
            raise FileNotFoundError("Missing original MP3: " + str(path))
        data = path.read_bytes()
        if len(data) != t["expectedBytes"]:
            raise ValueError("File length mismatch for " + path.name)
        if hashlib.sha256(data).hexdigest() != t["sha256"]:
            raise ValueError("File checksum mismatch for " + path.name)
        bpm = t["bpm"]
        if t["phase"] == "kitchen" and bpm < 120:
            raise ValueError("Wrong cooking tempo: " + t["id"])
        if t["phase"] == "dinner" and not (80 <= bpm <= 100):
            raise ValueError("Wrong dinner tempo: " + t["id"])
        if t["phase"] == "after" and bpm > 80:
            raise ValueError("Wrong after tempo: " + t["id"])

    m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    initial = [t["id"] for group in m["playlists"].values() for t in group["tracks"]]
    if len(initial) != len(set(initial)):
        raise ValueError("Existing manifest already has duplicate IDs")
    credits = CREDITS.read_text(encoding="utf-8")
    groups = {key: [] for key in NAMES}
    for t in tracks:
        if t["id"] in initial:
            raise ValueError("Already activated: " + t["id"])
        track = {
            "id": t["id"], "artist": t["artist"], "title": t["title"],
            "bpm": round(t["bpm"]), "durationSeconds": round(t["durationSeconds"]),
            "src": t["src"], "source": t["source"],
            "license": {
                "id": "CC-BY-4.0",
                "name": "Creative Commons Attribution 4.0",
                "url": "https://creativecommons.org/licenses/by/4.0/",
                "streamingAllowed": True,
                "creditRequired": True
            },
            "attribution": 'Music by Dark Antey. "' + t["title"]
                           + '". Source: ' + t["source"] + ". CC BY 4.0.",
            "tempoReviewed": "estimated (ambient soundtrack); confirm by listening",
        }
        groups[t["phase"]].append(track)
        m["playlists"][t["phase"]]["tracks"].append(track)

    for key, name in NAMES.items():
        match = re.search(
            r"(<h2>" + re.escape(name)
            + r" <small>\()(\d+)(\)</small></h2><ol>)(.*?)(</ol></section>)",
            credits, re.S,
        )
        if not match:
            raise ValueError("Missing credits chapter " + name)
        actual_count = match.group(4).count("<li>")
        if actual_count != int(match.group(2)):
            raise ValueError("Wrong previous credits count in " + name)
        new_items = "".join(
            '<li><strong>' + escape(t["title"]) + '</strong> · Dark Antey · '
            + '≈' + str(t["bpm"]) + ' BPM (оценка) · '
            + '<a href="https://darkantey.bandcamp.com/album/silent-depths" target="_blank" rel="noopener noreferrer">Источник автора</a> · '
            + '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> · Music by Dark Antey</li>\n'
            for t in groups[key]
        )
        replacement = (match.group(1) + str(actual_count + len(groups[key]))
                       + match.group(3) + match.group(4) + new_items + match.group(5))
        credits = credits[:match.start()] + replacement + credits[match.end():]
    old_count = len(initial)
    new_count = sum(len(x["tracks"]) for x in m["playlists"].values())
    if new_count != old_count + 15:
        raise ValueError("Unexpected playlist total after activation")
    credits = credits.replace(
        "В коллекции " + str(old_count) + " композиция:",
        "В коллекции " + str(new_count) + " композиций:")
    credits = credits.replace(
        "В коллекции " + str(old_count) + " композиции:",
        "В коллекции " + str(new_count) + " композиций:")
    m["metadataNote"] = (
        "15 MP3 Dark Antey / Silent Depths (CC BY 4.0 source credits; "
        "Bandcamp license label conflict documented). BPM for ambient recordings is preliminary. "
        "Total tracks: " + str(new_count) + "."
    )
    MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    CREDITS.write_text(credits, encoding="utf-8")
    print("ACTIVATED", json.dumps(
        {"added": 15, "count": new_count, "perPlaylist": {
            key: len(m["playlists"][key]["tracks"]) for key in NAMES
        }}, ensure_ascii=False))


if __name__ == "__main__":
    main()
