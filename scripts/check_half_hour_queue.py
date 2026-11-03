#!/usr/bin/env python3
"""Read-only cross-check of half-hour archive queue and technical checkpoint.

Usage: python3 scripts/check_half_hour_queue.py QUEUE_JSON CHECKPOINT_JSON
This is NOT a visual, ingredient, or licensing approval.
"""
import json
import sys
from pathlib import Path


def validate(queue, checkpoint):
    errors = []
    if not isinstance(queue, dict) or not isinstance(checkpoint, dict):
        return ["Queue and checkpoint roots must be JSON objects"]
    records = queue.get("first_50")
    results = checkpoint.get("results")
    if not isinstance(records, list) or not isinstance(results, dict):
        return ["Invalid queue first_50 or checkpoint results structure"]
    numbers, ids = set(), set()
    for row in records:
        if not isinstance(row, dict):
            errors.append("Non-object queue row")
            continue
        number, recipe_id = row.get("number"), row.get("recipe_id")
        if type(number) is not int or not 1 <= number <= 100:
            errors.append(f"Invalid number {number!r}")
        if number in numbers:
            errors.append(f"Duplicate number {number}")
        numbers.add(number)
        if not isinstance(recipe_id, str) or not recipe_id:
            errors.append(f"Missing recipe ID at {number}")
            continue
        if recipe_id in ids:
            errors.append(f"Duplicate recipe ID {recipe_id}")
        ids.add(recipe_id)
        status = row.get("technical_status")
        if status not in ("technical_pass", "not_checked"):
            errors.append(f"Unknown technical status for {recipe_id}: {status!r}")
        if status == "not_checked" and row.get("technical_sha256"):
            errors.append(f"Unchecked row carries technical SHA for {recipe_id}")
        if status == "technical_pass":
            evidence = results.get(recipe_id)
            if not isinstance(evidence, dict) or evidence.get("status") != "technical_pass":
                errors.append(f"Unsupported technical_pass for {recipe_id}")
            elif row.get("technical_sha256") != evidence.get("sha256"):
                errors.append(f"Checkpoint hash differs for {recipe_id}")
        if row.get("editorial_status") in ("approved", "publication_approved"):
            errors.append(f"Archive editorial approval not established: {recipe_id}")
        if row.get("license_status") in ("approved", "verified"):
            errors.append(f"Archive license clearance not established: {recipe_id}")
    if any(not isinstance(v, dict) or v.get("status") != "technical_pass" for v in results.values()):
        errors.append("Checkpoint contains non-passing or malformed result")
    if checkpoint.get("technically_verified") != len(results):
        errors.append("Checkpoint count does not match results")
    return errors


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: check_half_hour_queue.py QUEUE_JSON CHECKPOINT_JSON")
    queue = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    checkpoint = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    problems = validate(queue, checkpoint)
    for problem in problems:
        print("ERROR:", problem)
    print("PASS" if not problems else f"FAIL ({len(problems)})")
    raise SystemExit(1 if problems else 0)


if __name__ == "__main__":
    main()
