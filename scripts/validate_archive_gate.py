#!/usr/bin/env python3
"""Validate archival photo review records. This does NOT verify images or licenses."""
import argparse
import json
from pathlib import Path


def validate(path):
    errors = []
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return [f"{path}: invalid JSON: {exc}"]
    records = data.get("records")
    if not isinstance(records, list) or not records:
        return [f"{path}: nonempty records list required"]
    seen = set()
    for i, record in enumerate(records):
        where = f"{path}: record {i}"
        if not isinstance(record, dict):
            errors.append(f"{where}: object required")
            continue
        n = record.get("number")
        if type(n) is not int or not 1 <= n <= 100:
            errors.append(f"{where}: number must be 1..100")
        elif n in seen:
            errors.append(f"{where}: duplicate number {n}")
        else:
            seen.add(n)
        for key in ("recipe_id", "recipe_title", "source_page", "technical_status",
                    "editorial_status", "rights_status", "evidence_scope"):
            if not isinstance(record.get(key), str) or not record[key].strip():
                errors.append(f"{where}: missing {key}")
        if not str(record.get("source_page", "")).startswith("https://"):
            errors.append(f"{where}: source must use HTTPS")
        if record.get("evidence_scope") == "source_filename_and_queue_metadata_only":
            if record.get("editorial_status") in ("approved", "visually_approved"):
                errors.append(f"{where}: metadata cannot establish visual approval")
            if record.get("rights_status") in ("cleared", "approved"):
                errors.append(f"{where}: metadata cannot establish license clearance")
        if n in (6, 10, 20) and record.get("editorial_status") in ("approved", "visually_approved"):
            errors.append(f"{where}: archived #{n} differs from approved replacement")
    if data.get("manual_visual_approved") == 0 and any(
        isinstance(r, dict) and r.get("editorial_status") in ("approved", "visually_approved")
        for r in records
    ):
        errors.append(f"{path}: visual approval counter contradicts records")
    if data.get("rights_cleared") == 0 and any(
        isinstance(r, dict) and r.get("rights_status") in ("cleared", "approved")
        for r in records
    ):
        errors.append(f"{path}: rights clearance counter contradicts records")
    return errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+")
    args = parser.parse_args()
    failures = [err for file in args.files for err in validate(file)]
    for err in failures:
        print(err)
    if failures:
        raise SystemExit(1)
    print(f"PASS: {len(args.files)} files structurally checked (not visually or legally approved)")
