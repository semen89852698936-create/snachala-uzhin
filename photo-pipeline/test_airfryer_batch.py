#!/usr/bin/env python3
"""Free preflight for the ten air-fryer Yandex photo prompts."""
from __future__ import annotations

import importlib.util
import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "photo-pipeline" / "generate_airfryer_batch.py"
parser = argparse.ArgumentParser()
parser.add_argument('--manifest', type=Path, default=ROOT / 'data' / 'airfryer-recipes-batch-01.json')
args = parser.parse_args()
spec = importlib.util.spec_from_file_location("airfryer_photo_generator", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

recipes = module.load_manifest(args.manifest)
assert len(recipes) == 10
prompts = [module.make_prompt(recipe) for recipe in recipes]
assert all(0 < len(prompt) <= module.MAX_PROMPT for prompt in prompts)
assert all('Блюдо:' in prompt and 'Single full-frame photograph' in prompt and 'No split-screen' in prompt and 'логотипов' in prompt for prompt in prompts)
assert len({recipe["id"] for recipe in recipes}) == 10
assert all(recipe["photo_status"] in {"not_started", "generated_verified_unpublished"} for recipe in recipes)
assert all(recipe.get("visual_review_status") in {"visually_accepted", "needs_regeneration", "pending_recheck"} for recipe in recipes)
assert all(recipe.get("visual_review_note") for recipe in recipes if recipe.get("visual_review_status") == "needs_regeneration")
assert all(recipe["publication_status"] == "not_published" for recipe in recipes)

result = subprocess.run(
    [sys.executable, str(SCRIPT), "--manifest", str(args.manifest), "--limit", "10"],
    cwd=ROOT,
    text=True,
    capture_output=True,
    check=True,
)
summary = json.loads(result.stdout.strip().splitlines()[-1])
assert summary["mode"] == "dry-run"
assert summary["created_or_prepared"] + summary["already_saved"] == 10
assert "GENERATED" not in result.stdout
print(json.dumps({
    "ok": True,
    "recipes": len(recipes),
    "unique_ids": len({recipe["id"] for recipe in recipes}),
    "prompts_within_500_chars": True,
    "dry_run_prepared": summary["created_or_prepared"],
    "already_saved": summary["already_saved"],
    "visual_regeneration_queue": sum(recipe.get("visual_review_status") == "needs_regeneration" for recipe in recipes),
    "paid_requests": 0,
}, ensure_ascii=False, indent=2))
