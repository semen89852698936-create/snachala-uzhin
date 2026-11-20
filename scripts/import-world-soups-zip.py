#!/usr/bin/env python3
"""Import only the eight user-approved Russian soup photographs from one ZIP.
Never overwrite already approved assets 09/10. No site publication is performed.
"""
import hashlib
import json
import os
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/"photo-import"/"soups-01-08.zip"
DEST=ROOT/"assets"/"world-soups"
EXPECTED=[f"assets/world-soups/{n:02}.webp" for n in range(1,9)]

def main():
    if not ARCHIVE.exists():
        raise SystemExit("Missing ZIP: photo-import/soups-01-08.zip. Nothing changed.")
    with zipfile.ZipFile(ARCHIVE,"r") as archive:
        names=archive.namelist()
        if sorted(names)!=sorted(EXPECTED+["approved-photo-registry.json","README.txt"]):
            raise SystemExit("Unexpected ZIP members: "+repr(names))
        registry=json.loads(archive.read("approved-photo-registry.json"))
        if len(registry)!=8 or [x.get("recipe_number") for x in registry]!=list(range(1,9)):
            raise SystemExit("Photo registry must contain numbers 1..8 in order.")
        from PIL import Image
        from io import BytesIO
        data={}
        for n,record in enumerate(registry,1):
            name=f"assets/world-soups/{n:02}.webp"
            if record.get("image")!=name:
                raise SystemExit(f"Photo mapping mismatch at #{n}")
            raw=archive.read(name)
            if hashlib.sha256(raw).hexdigest()!=record["sha256"]:
                raise SystemExit(f"SHA-256 mismatch at #{n}")
            if len(raw)<20000 or len(raw)>3000000:
                raise SystemExit(f"Image size outside QA range at #{n}")
            with Image.open(BytesIO(raw)) as im:
                im.verify()
            with Image.open(BytesIO(raw)) as im:
                if im.format!="WEBP" or im.width<1000 or im.height<650:
                    raise SystemExit(f"Wrong format/resolution at #{n}")
            path=ROOT/name
            if path.exists() and path.read_bytes()!=raw:
                raise SystemExit(f"Refusing to overwrite a different file at #{n}")
            data[path]=raw
        DEST.mkdir(parents=True,exist_ok=True)
        for path,raw in data.items():
            path.write_bytes(raw)
    assert all((DEST/f"{i:02}.webp").exists() for i in range(1,11))
    print("SUCCESS: eight approved WebP photos imported. All ten world-soup images now exist.")

if __name__=="__main__":
    main()
