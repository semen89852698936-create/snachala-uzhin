#!/usr/bin/env python3
"""Reconstruct 24 user-supplied Dark Antey MP3 originals from GitHub-staged chunks.

FAIL CLOSED: no playlist changes or copyright credits are saved unless every
original file's SHA-256, byte length, title/ID and phase passes. Does NOT deploy.
"""
import base64
import hashlib
import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRACKS = ROOT / "music/dark-antey-24-upload-manifest.json"
MANIFEST = ROOT / "music/native-player-manifest.json"
CREDITS = ROOT / "music/credits.html"
INTAKE = ROOT / "music/russian-licensed-intake-20261112.json"
STAGING = ROOT / "music/.import-b64"
PLAYLIST_NAMES = {"kitchen": "Под что готовить", "dinner": "Под что ужинать", "after": "Под что продолжить"}
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"


def validate_track(row):
    path_value = row["src"]
    if not path_value.startswith("/assets/music/dark-antey/") or not path_value.endswith(".mp3"):
        raise ValueError("Unsafe or wrong audio path: " + path_value)
    target = (ROOT / path_value.lstrip("/")).resolve()
    target.relative_to(ROOT.resolve())
    bpm = float(row["approxBpm"])
    phase = row["phase"]
    if phase not in PLAYLIST_NAMES:
        raise ValueError("Unexpected phase")
    if phase == "kitchen" and bpm < 120:
        raise ValueError("Out-of-band cooking BPM")
    if phase == "dinner" and not 80 <= bpm <= 100:
        raise ValueError("Out-of-band dinner BPM")
    if phase == "after" and bpm > 80:
        raise ValueError("Out-of-band after BPM")
    return target


def verify_bytes(row, data):
    if len(data) != row["expectedBytes"]:
        raise ValueError("Byte length mismatch for " + row["id"])
    digest = hashlib.sha256(data).hexdigest()
    if digest != row["sha256"]:
        raise ValueError("SHA-256 mismatch for " + row["id"])
    return digest


def materialize(row):
    path = validate_track(row)
    if path.is_file():
        data = path.read_bytes()
        verify_bytes(row, data)
        return path, "preexisting"
    chunk_dir = STAGING / row["id"]
    parts = sorted(chunk_dir.glob("*.b64"))
    if not parts:
        raise FileNotFoundError("GitHub b64 parts missing: " + row["id"])
    if [p.name for p in parts] != [f"{i:03d}.b64" for i in range(len(parts))]:
        raise ValueError("Incorrect part ordering for " + row["id"])
    text = "".join(part.read_text("ascii") for part in parts)
    data = base64.b64decode(text, validate=True)
    verify_bytes(row, data)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path, "restored"


def add_credits(html, entries, previous_counts):
    for phase, label in PLAYLIST_NAMES.items():
        pattern = re.compile(
            r"(<h2>" + re.escape(label) + r" <small>\()(\d+)(\)</small></h2><ol>)(.*?)(</ol></section>)",
            flags=re.S,
        )
        match = pattern.search(html)
        if not match:
            raise ValueError("Credit chapter missing: " + phase)
        count = int(match.group(2))
        if count != previous_counts[phase] or match.group(4).count("<li>") != count:
            raise ValueError("Credit chapter does not match previous playlist: " + phase)
        new_entries = []
        for track in entries[phase]:
            new_entries.append(
                '<li><strong>' + escape(track["title"]) + '</strong> · Dark Antey · '
                '<a href="' + escape(track["source"], quote=True) + '" target="_blank" rel="noopener noreferrer">Источник автора</a> · '
                '<a href="' + LICENSE_URL + '" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> · '
                'Music by Dark Antey · запись без изменений</li>'
            )
        new_segment = (
            match.group(1) + str(count + len(entries[phase])) + match.group(3)
            + match.group(4) + "\n" + "\n".join(new_entries) + match.group(5)
        )
        html = html[:match.start()] + new_segment + html[match.end():]
    intro_pattern = r"<p>В коллекции 51 композиция:.*?</p>"
    replacement = (
        '<p>В коллекции 75 композиций: 40 произведений Kevin MacLeod, 2 записи Sergey Cheremisinov, '
        '9 записей Tunguska E.M.S. / Евгения Науменко и 24 записи Dark Antey из альбомов '
        'Silent Depths и Deep Russian Depression. Для каждого произведения указаны автор, '
        'источник и лицензия. Dark Antey прямо разрешает коммерческое использование по CC BY 4.0; '
        'одновременно отдельное поле Bandcamp содержит надпись All rights reserved. '
        'Используйте записи с соблюдением указанных условий автора.</p>'
    )
    html, matches = re.subn(intro_pattern, replacement, html, count=1, flags=re.S)
    if matches != 1:
        raise ValueError("Unable to update credit introduction")
    return html


def main():
    data = json.loads(TRACKS.read_text("utf-8"))
    items = data["tracks"]
    if len(items) != 24 or len({x["id"] for x in items}) != 24:
        raise ValueError("Exactly 24 unique audio recordings expected")
    if sum(x["expectedBytes"] for x in items) != data["totalMP3Bytes"]:
        raise ValueError("Manifest byte count mismatch")
    restored = []
    for track in items:
        path, how = materialize(track)
        restored.append((track["id"], how, str(path.relative_to(ROOT))))
        print("AUDIO_VERIFIED " + track["id"] + " " + how + " " + track["sha256"], flush=True)

    music = json.loads(MANIFEST.read_text("utf-8"))
    old_counts = {k: len(v["tracks"]) for k, v in music["playlists"].items()}
    if old_counts != {"kitchen": 10, "dinner": 22, "after": 19}:
        raise ValueError("Unexpected music baseline, refusing playlist overwrite")
    existing = {t["id"] for v in music["playlists"].values() for t in v["tracks"]}
    if len(existing) != 51:
        raise ValueError("Duplicate baseline music IDs")
    by_phase = {k: [] for k in PLAYLIST_NAMES}
    for row in items:
        if row["id"] in existing:
            raise ValueError("Dark Antey original already in manifest: " + row["id"])
        entry = {
            "id": row["id"], "artist": "Dark Antey", "title": row["title"],
            "bpm": round(row["approxBpm"]),
            "durationSeconds": round(row["durationSeconds"]),
            "src": row["src"], "source": row["source"],
            "license": {
                "id": "CC-BY-4.0", "name": "Creative Commons Attribution 4.0",
                "url": LICENSE_URL, "streamingAllowed": True, "creditRequired": True,
            },
            "attribution": (
                'Music by Dark Antey. "' + row["title"] + '" from ' + row["album"]
                + ". Source: " + row["source"] + ". CC BY 4.0. No changes made."
            ),
            "tempoReviewed": "approximate beat analysis of complete supplied MP3 (not independently confirmed)",
        }
        by_phase[row["phase"]].append(entry)
        music["playlists"][row["phase"]]["tracks"].append(entry)
    totals = {k: len(v["tracks"]) for k, v in music["playlists"].items()}
    if totals != {"kitchen": 10, "dinner": 40, "after": 25}:
        raise ValueError("Unexpected playlist totals: " + str(totals))
    music["stage"] = "licensed-audio-feature-branch-not-public"
    music["notice"] = (
        "75 compositions in GitHub feature branch. 24 original Dark Antey MP3 files validated by SHA-256. "
        "Author CC BY 4.0 notice and inconsistent Bandcamp footer disclosed in credits. "
        "Live site playback and access from Russia require independent testing."
    )
    music["metadataNote"] = (
        "No 20-track cap. Dark Antey tempo estimates are tentative, particularly on ambient pieces. "
        "Two tracks from Deep Russian Depression remain missing from the user's supplied uploads."
    )
    credits = add_credits(CREDITS.read_text("utf-8"), by_phase, old_counts)
    intake = json.loads(INTAKE.read_text("utf-8"))
    source_map = {r["id"]: r for r in items}
    for t in intake["tracks"]:
        row = source_map.get(t["id"])
        if row:
            t["tempoBpm"] = row["approxBpm"]
            t["assignedPlaylist"] = row["phase"]
            t["mediaUrl"] = row["src"]
            t["sha256"] = row["sha256"]
            t["audioFilesUploadedToRepository"] = True
            t["audible"] = True
            t["reviewStatus"] = "original-MP3-SHA256-verified-on-GitHub-feature-branch-not-public"
            t["license"]["commercialUseVerified"] = False  # Bandcamp footer contradicts author CC BY statement.
            t["licenseEvidence"]["authorCredit"] = "Music by Dark Antey"
            t["publishStatus"] = "feature-branch-source-only; live playback/regional test pending"
    intake["darkAnteyAudit"]["filesReceivedInChatUnique"] = 24
    intake["darkAnteyAudit"]["fullAudioFilesObtained"] = 24
    intake["darkAnteyAudit"]["playableAdded"] = 24
    intake["darkAnteyAudit"]["twoMissingTitles"] = [
        "Deep Russian Depression", "Deep Russian Depression (Instrumental)",
    ]
    MANIFEST.write_text(json.dumps(music, ensure_ascii=False, indent=2) + "\n", "utf-8")
    CREDITS.write_text(credits, "utf-8")
    INTAKE.write_text(json.dumps(intake, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print("ASSEMBLY_COMPLETE " + json.dumps({"files": 24, "totalBytes": data["totalMP3Bytes"],
                                              "counts": totals, "source": "GitHub branch"},
                                             ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
