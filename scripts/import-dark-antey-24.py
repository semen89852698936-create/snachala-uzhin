#!/usr/bin/env python3
"""Import exactly 24 original Dark Antey MP3 from the verified local ZIP.

No changes to existing site UI, no branch merge, and no deployment.
Usage: python3 scripts/import-dark-antey-24.py /path/to/dark-antey-24-originals-github-handoff.zip

Only run on a feature branch. The archive is distributed separately from GitHub;
the GitHub branch contains reference metadata, not MP3 bytes until this script runs
and the user pushes the resulting binary commit.
"""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MUSIC=ROOT / "music"
SILENT=json.loads((MUSIC/"dark-antey-silent-depths-staging-20261112.json").read_text())
DEEP=json.loads((MUSIC/"dark-antey-deep-russian-depression-staging-20261112.json").read_text())
TRACKS=SILENT["tracks"]+DEEP["tracks"]

def main():
    if len(sys.argv)!=2:
        raise SystemExit("Usage: import-dark-antey-24.py PATH-TO-VERIFIED-ZIP")
    if len(TRACKS)!=24:
        raise SystemExit("Expected 24 unique source tracks")
    zip_path=Path(sys.argv[1])
    with zipfile.ZipFile(zip_path) as src:
        # Verify complete binary content before writing any files.
        pending=[]
        for tr in TRACKS:
            name=tr["src"].lstrip("/")
            if not name.startswith("assets/music/dark-antey/") or ".." in name.split("/"):
                raise ValueError("Invalid target path: "+name)
            body=src.read(name)
            if len(body)!=tr["expectedBytes"]:
                raise ValueError("Size mismatch for "+name)
            if hashlib.sha256(body).hexdigest()!=tr["sha256"]:
                raise ValueError("SHA-256 mismatch for "+name)
            pending.append((ROOT/name,body))
        for dest,body in pending:
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(body)
    print(f"Copied {len(pending)} verified MP3 files to Git working tree.")
    print("24 original audio assets ready for git add/commit/push.")
    print("Playlist activation requires license and independent playback QA.")
    print("No live production deployment has been triggered.")

if __name__=="__main__":
    main()
