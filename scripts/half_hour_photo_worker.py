#!/usr/bin/env python3
"""Evidence-only half-hour GitHub photo producer.

Fetches real staging WebP bytes incrementally, verifies signatures/dimensions/
SHA-256, and saves an actionable editorial queue to a NON-production Git branch.
No AI costs, user secrets, purchases, PR merges or production releases.
"""
from __future__ import annotations

import argparse
import base64
from datetime import datetime, timezone
from hashlib import sha256
import json
import os
from pathlib import Path
import struct
import sys
import urllib.error
import urllib.parse
import urllib.request

REVIEW_REF = "photo-library/restore-100-review-20261102"
CHECKPOINT_REF = "automation/half-hour-photo-audit"
ARCHIVE = "photo-library/batch-100-20261101"
CHECKPOINT_FILE = "project-operations/half-hour-checkpoint.json"
QUEUE_FILE = "photo-library/half-hour-review-queue.json"
MAX_PER_RUN = 5


def dimensions_webp(data: bytes) -> tuple[int, int]:
    if len(data) < 30 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError("Invalid RIFF WEBP header")
    if struct.unpack_from("<I", data, 4)[0] + 8 != len(data):
        raise ValueError("RIFF byte length mismatch")
    tag = data[12:16]
    if tag == b"VP8 ":
        if data[23:26] != b"\x9d\x01\x2a":
            raise ValueError("Invalid VP8 frame marker")
        w, h = struct.unpack_from("<HH", data, 26)
        return w & 0x3FFF, h & 0x3FFF
    if tag == b"VP8L":
        if len(data) < 25 or data[20] != 0x2F:
            raise ValueError("Invalid VP8L signature")
        bits = int.from_bytes(data[21:25], "little")
        return 1 + (bits & 0x3FFF), 1 + ((bits >> 14) & 0x3FFF)
    if tag == b"VP8X":
        if len(data) < 30:
            raise ValueError("VP8X payload too short")
        return 1 + int.from_bytes(data[24:27], "little"), 1 + int.from_bytes(data[27:30], "little")
    raise ValueError("Unsupported WebP chunk: " + repr(tag))


def inspect_image(item: dict, content: bytes) -> dict:
    expected = str(item.get("sha256") or "")
    actual = sha256(content).hexdigest()
    if len(expected) != 64 or any(ch not in "0123456789abcdef" for ch in expected):
        raise ValueError("Missing or malformed recorded SHA-256")
    width, height = dimensions_webp(content)
    recorded = item.get("size")
    if isinstance(recorded, list) and len(recorded) == 2:
        if [width, height] != recorded:
            raise ValueError(f"Dimensions mismatch: {[width, height]} vs {recorded}")
    if expected != actual:
        raise ValueError(f"SHA-256 mismatch: expected {expected}, got {actual}")
    if isinstance(item.get("bytes"), int) and item["bytes"] != len(content):
        raise ValueError(f"Byte count mismatch: {len(content)} vs {item['bytes']}")
    return {"status": "technical_pass", "sha256": actual, "width": width,
            "height": height, "bytes": len(content)}


def validate_manifest(manifest: dict) -> list[dict]:
    items = manifest.get("sources")
    if not isinstance(items, list) or len(items) != 100:
        raise ValueError("Photo source manifest should include 100 entries")
    nums, ids, paths, hashes = set(), set(), set(), set()
    for item in items:
        n, rid, name, digest = item.get("number"), item.get("recipe_id"), item.get("file"), item.get("sha256")
        if n in nums or rid in ids or name in paths or digest in hashes:
            raise ValueError(f"Duplicate photo identity: {n}, {rid}")
        if not isinstance(n, int) or n < 1 or n > 100:
            raise ValueError(f"Invalid number: {n}")
        if not isinstance(rid, str) or not rid:
            raise ValueError(f"Missing recipe ID: {n}")
        if not isinstance(name, str) or not name.startswith("photos/") or not name.endswith(".webp") or ".." in name:
            raise ValueError(f"Invalid safe photo path: {n}")
        if not isinstance(digest, str) or len(digest) != 64:
            raise ValueError(f"Invalid checksum: {n}")
        if not str(item.get("source_page", "")).startswith("https://") or not item.get("license"):
            raise ValueError(f"Missing source or license: {n}")
        nums.add(n)
        ids.add(rid)
        paths.add(name)
        hashes.add(digest)
    return sorted(items, key=lambda x: x["number"])


def pending_photos(items: list[dict], results: dict, max_count: int = MAX_PER_RUN) -> list[dict]:
    fresh = [x for x in items if
             results.get(x["recipe_id"], {}).get("sha256") != x["sha256"]]
    retry = [x for x in items if
             results.get(x["recipe_id"], {}).get("status") != "technical_pass"
             and x not in fresh]
    return (fresh + retry)[:max_count]


def load_editorial_signals(items: list[dict]) -> dict[str, dict]:
    """Review hints from source captions only, never approval or visual detection."""
    path = Path(__file__).resolve().parents[1] / "photo-library/editorial-risk-signals.json"
    if not path.is_file():
        return {}
    report = json.loads(path.read_text(encoding="utf-8"))
    if report.get("schema_version") != 1:
        raise ValueError("Unsupported editorial triage schema")
    by_number = {row["number"]: row for row in items}
    hints = {}
    for record in report.get("records", []):
        n = record.get("number")
        item = by_number.get(n)
        if item is None or record.get("recipe_id") != item["recipe_id"]:
            raise ValueError(f"Editorial triage does not match manifest: {n}")
        if record.get("source_url") != item["source_page"]:
            raise ValueError(f"Source changed since editorial triage: {n}")
        if record.get("severity") not in {"high", "medium"}:
            raise ValueError(f"Invalid triage severity: {n}")
        if item["recipe_id"] in hints:
            raise ValueError(f"Repeated triage entry: {n}")
        hints[item["recipe_id"]] = record
    return hints


def queue_entries(items: list[dict], results: dict,
                  editorial_signals: dict[str, dict] | None = None) -> list[dict]:
    queue = []
    editorial_signals = editorial_signals or {}
    for item in items:
        checked = results.get(item["recipe_id"], {})
        license_name = item.get("license", "")
        flags = []
        if license_name.startswith("CC BY"):
            flags.append("attribution_required")
        if "SA" in license_name:
            flags.append("share_alike_terms_require_review")
        if not item.get("author") or str(item.get("author")).lower().startswith("see source"):
            flags.append("photographer_name_not_resolved")
        if not item.get("exact_ingredient_match_verified"):
            flags.append("ingredient_match_unverified")
        triage = editorial_signals.get(item["recipe_id"])
        if triage:
            flags.append("source_caption_requires_priority_review")
        technical_status = checked.get("status", "not_checked")
        if technical_status == "technical_pass" and checked.get("sha256") != item["sha256"]:
            technical_status = "stale_sha_needs_recheck"
        queue.append({
            "number": item["number"], "recipe_id": item["recipe_id"],
            "recipe_title": item.get("title"),
            "source_photo_title": item.get("source_photo_title"),
            "source_page": item["source_page"], "license": license_name,
            "license_url": item.get("license_url"),
            "technical_status": technical_status,
            "technical_sha256": checked.get("sha256"),
            "editorial_status": "requires_visual_review",
            "license_status": "requires_individual_verification",
            "source_caption_risk": triage.get("severity") if triage else "not_flagged",
            "source_caption_review_note": triage.get("reason") if triage else None,
            "source_caption_evidence": "metadata_only_not_visual" if triage else None,
            "flags": flags
        })
    return queue


def api(repo: str, method: str, suffix: str, token: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    url = f"https://api.github.com/repos/{repo}/{suffix}"
    headers = {"Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28",
               "User-Agent": "snachala-uzhin-half-hour-photo-worker"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        # Do not log request credentials or response bodies.
        raise RuntimeError(f"GitHub API {method} {suffix.split('?')[0]}: HTTP {exc.code}") from exc


def file_at(repo: str, path: str, ref: str, token: str) -> tuple[bytes, str]:
    query = urllib.parse.urlencode({"ref": ref})
    obj = api(repo, "GET", f"contents/{urllib.parse.quote(path, safe='/')}?{query}", token)
    if obj.get("encoding") != "base64":
        raise ValueError(f"File unexpectedly not base64: {path}")
    return base64.b64decode(obj["content"]), obj["sha"]


def try_file_at(repo: str, path: str, ref: str, token: str) -> tuple[bytes, str] | None:
    try:
        return file_at(repo, path, ref, token)
    except RuntimeError as exc:
        if str(exc).endswith("HTTP 404"):
            return None
        raise


def ensure_checkpoint_branch(repo: str, token: str) -> None:
    ref_path = "git/ref/heads/" + CHECKPOINT_REF
    try:
        api(repo, "GET", ref_path, token)
        return
    except RuntimeError as exc:
        if not str(exc).endswith("HTTP 404"):
            raise
    base = api(repo, "GET", "git/ref/heads/main", token)["object"]["sha"]
    try:
        api(repo, "POST", "git/refs", token,
            {"ref": "refs/heads/" + CHECKPOINT_REF, "sha": base})
    except RuntimeError as exc:
        if not str(exc).endswith("HTTP 422"):
            raise
        api(repo, "GET", ref_path, token)  # another run created it


def save_if_changed(repo: str, path: str, obj: dict, token: str) -> bool:
    payload = (json.dumps(obj, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")
    original = try_file_at(repo, path, CHECKPOINT_REF, token)
    if original is not None and original[0] == payload:
        return False
    body = {"message": "Store verified incremental photo audit checkpoint",
            "branch": CHECKPOINT_REF,
            "content": base64.b64encode(payload).decode("ascii")}
    if original:
        body["sha"] = original[1]
    api(repo, "PUT", "contents/" + path, token, body)
    return True


def execute(repo: str, token: str, live: bool) -> dict:
    if not repo or not token:
        raise ValueError("GITHUB_REPOSITORY and GITHUB_TOKEN are required")
    manifest_bytes = None
    ref_used = None
    for source_ref in ("main", REVIEW_REF):
        source = try_file_at(repo, ARCHIVE + "/manifest.json", source_ref, token)
        if source:
            manifest_bytes, _ = source
            ref_used = source_ref
            break
    if manifest_bytes is None:
        raise RuntimeError("No source photo manifest found in main or review branch")
    items = validate_manifest(json.loads(manifest_bytes))
    old_state = try_file_at(repo, CHECKPOINT_FILE, CHECKPOINT_REF, token)
    if old_state:
        state = json.loads(old_state[0])
        results = dict(state.get("results") or {})
    else:
        results = {}
    selected = pending_photos(items, results)
    checked = []
    for item in selected:
        try:
            file_bytes, _ = file_at(repo, ARCHIVE + "/" + item["file"], ref_used, token)
            result = inspect_image(item, file_bytes)
            result["checked_utc"] = datetime.now(timezone.utc).isoformat()
        except (RuntimeError, ValueError, OSError) as exc:
            result = {"status": "technical_fail", "expected_sha256": item["sha256"],
                      "error": str(exc)[:250],
                      "checked_utc": datetime.now(timezone.utc).isoformat()}
        result["sha256"] = item["sha256"] if result["status"] != "technical_pass" else result["sha256"]
        results[item["recipe_id"]] = result
        checked.append({"recipe_id": item["recipe_id"], "number": item["number"],
                        "status": result["status"], "detail": result.get("error")})
    passing = sum(results.get(x["recipe_id"], {}).get("status") == "technical_pass" and
                  results.get(x["recipe_id"], {}).get("sha256") == x["sha256"]
                  for x in items)
    editorial_signals = load_editorial_signals(items)
    queue = queue_entries(items, results, editorial_signals)
    state_out = {
        "schema_version": 1, "source_ref": ref_used,
        "source_manifest_sha256": sha256(manifest_bytes).hexdigest(),
        "total_archive_candidates": len(items), "technically_verified": passing,
        "remaining_for_technical_check": len(items) - passing,
        "manual_editorial_approved": 0,
        "results": results,
        "publication": "review_only_not_production",
        "note": "Physical file integrity is not ingredient correctness, license clearance or publication approval."
    }
    queue_out = {
        "schema_version": 1, "source_ref": ref_used,
        "total_candidates": len(queue),
        "source_caption_flagged": len(editorial_signals),
        "source_caption_high_priority": sum(v["severity"] == "high" for v in editorial_signals.values()),
        "source_caption_risks_are_visual_approval": False,
        "first_50": queue[:50],
        "second_50": queue[50:],
        "note": "All images remain pending individual visual and rights review."
    }
    wrote = []
    if live:
        ensure_checkpoint_branch(repo, token)
        if save_if_changed(repo, CHECKPOINT_FILE, state_out, token):
            wrote.append(CHECKPOINT_FILE)
        if save_if_changed(repo, QUEUE_FILE, queue_out, token):
            wrote.append(QUEUE_FILE)
    return {"repo": repo, "source_ref": ref_used, "tested_this_run": checked,
            "archive_candidates": len(items), "verified": passing,
            "remaining": len(items) - passing, "checkpoint_branch": CHECKPOINT_REF,
            "saved": wrote, "dry_run": not live,
            "claim": "SHA-256/format check only; NOT visual or license approval"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Verify files but do not write a branch")
    args = parser.parse_args()
    report = execute(os.getenv("GITHUB_REPOSITORY", ""),
                     os.getenv("GITHUB_TOKEN", ""), live=not args.dry_run)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    Path("half-hour-run-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if any(r["status"] == "technical_fail" for r in report["tested_this_run"]):
        print("WARNING: Some photos failed technical verification.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
