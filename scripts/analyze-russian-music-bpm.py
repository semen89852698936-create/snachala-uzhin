#!/usr/bin/env python3
"""Non-publishing offline BPM audit for source-backed Russian music candidates.

Fetches only recordings from Wikimedia Commons and Internet Archive.
Produces measured candidates for human review, NEVER silently publishes audio.
Requirements: numpy, librosa, soundfile. Audio decoded directly from OGG.
"""
import hashlib
import json
import math
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "music" / "russian-licensed-intake-20261112.json"
OUTPUT = Path("/tmp/russian-music-bpm-audit.json")
USER_AGENT = "Mozilla/5.0 (compatible; SnachalaUzhinMusicRightsAudit/1.0; +https://github.com/semen89852698936-create/snachala-uzhin)"


def commons_audio_url(filename):
    normalized = filename.replace(" ", "_")
    digest = hashlib.md5(normalized.encode("utf-8")).hexdigest()
    quoted = urllib.parse.quote(normalized, safe="._-")
    return f"https://upload.wikimedia.org/wikipedia/commons/{digest[0]}/{digest[:2]}/{quoted}"


def fetch_audio(url, filename):
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "audio/ogg,audio/*;q=0.9,*/*;q=0.2",
    })
    with urllib.request.urlopen(req, timeout=45) as response, open(filename, "wb") as out:
        total = 0
        while True:
            buf = response.read(1024 * 512)
            if not buf:
                break
            total += len(buf)
            if total > 38_000_000:
                raise RuntimeError("Audio exceeds safety limit of 38 MB")
            out.write(buf)
    if total < 40_000:
        raise RuntimeError("Download too small: not a real audio file")
    return total


def analyze_file(path):
    import librosa
    import numpy as np

    import soundfile as sf
    with sf.SoundFile(str(path)) as audio:
        sample_rate = audio.samplerate
        offset = min(int(14 * sample_rate), max(0, audio.frames - 30 * sample_rate))
        audio.seek(offset)
        samples = audio.read(int(105 * sample_rate), dtype="float32", always_2d=True)
    if samples.size == 0:
        raise RuntimeError("Audio is empty")
    mono = np.mean(samples, axis=1)
    sr = 11025
    y = librosa.resample(mono, orig_sr=sample_rate, target_sr=sr)
    if True:
        if len(y) < sr * 20:
            raise RuntimeError("Insufficient decodable audio")
        hop = 256
        envelope = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
        if float(np.max(envelope)) < 0.01:
            return {"bpm": None, "confidence": 0, "reason": "no-discernible-pulse"}
        tempo, beats = librosa.beat.beat_track(
            onset_envelope=envelope, sr=sr, hop_length=hop, trim=False,
            start_bpm=100,
        )
        bpm = float(np.atleast_1d(tempo)[0])
        times = librosa.frames_to_time(beats, sr=sr, hop_length=hop)
        if len(times) < 10 or not math.isfinite(bpm):
            return {"bpm": None, "confidence": 0, "reason": "fewer-than-ten-beats"}
        intervals = np.diff(times)
        median = float(np.median(intervals))
        mad = float(np.median(np.abs(intervals - median)))
        bpm_intervals = float(60 / median) if median else bpm
        spread = mad / max(median, 0.001)
        # On ambient tracks a periodic beat may not exist at all.
        confidence = round(max(0., min(1., 1 - 2.4 * spread)) * min(1., len(times)/48), 3)
        if confidence < 0.68:
            return {"bpm": round(bpm_intervals, 1), "confidence": confidence, "reason": "unreliable-tempo"}
        return {"bpm": round(bpm_intervals, 1), "confidence": confidence, "reason": "estimate-needs-listening-confirmation"}


def group(bpm):
    if bpm is None:
        return None
    if bpm >= 120:
        return "kitchen"
    if 80 <= bpm <= 100:
        return "dinner"
    if bpm <= 80:
        return "after"
    return None


def run():
    raw = json.loads(CATALOG.read_text(encoding="utf-8"))
    assert len(raw["tracks"]) == 43
    results = []
    with tempfile.TemporaryDirectory() as td:
        for track in raw["tracks"]:
            if track["collection"].startswith("dark-antey"):
                # Licensing page contradiction and no stable audio source.
                results.append({"id": track["id"], "status": "rights-hold"})
                continue
            url = (commons_audio_url(track["filename"]) if track["sourceMedia"] == "wikimedia-commons"
                   else track["mediaUrl"])
            record = {"id": track["id"], "artist": track["artist"],
                      "title": track["title"], "url": url}
            try:
                target = Path(td) / (track["id"] + ".ogg")
                record["audioBytes"] = fetch_audio(url, target)
                measured = analyze_file(target)
                record.update(measured)
                record["playlistSuggestion"] = (
                    group(measured["bpm"]) if measured["confidence"] >= 0.68 else None
                )
                record["status"] = "measured-pending-manual-verification"
            except Exception as exc:
                record["status"] = "error"
                record["error"] = f"{type(exc).__name__}: {exc}"
            if track["sourceMedia"] == "wikimedia-commons":
                time.sleep(9)  # Wikimedia per-user rate limit: prevent burst traffic.
            print("TEMPO_RESULT " + json.dumps(record, ensure_ascii=False), flush=True)
            results.append(record)
    OUTPUT.write_text(json.dumps({"status": "non-publishing", "records": results},
                                 ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("BPM_AUDIT_SUMMARY " + json.dumps({
        "total": len(results),
        "measured": sum(x["status"] == "measured-pending-manual-verification" for x in results),
        "errors": sum(x["status"] == "error" for x in results),
        "rightsHold": sum(x["status"] == "rights-hold" for x in results),
        "suggested": {
            phase: sum(x.get("playlistSuggestion") == phase for x in results)
            for phase in ("kitchen", "dinner", "after")
        }
    }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    run()
