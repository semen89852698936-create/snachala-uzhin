#!/usr/bin/env python3
"""Free preflight for the ten air-fryer Yandex photo prompts."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "photo-pipeline" / "generate_airfryer_batch.py"
spec = importlib.util.spec_from_file_location("airfryer_photo_generator", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

recipes = module.load_manifest()
assert len(recipes) == 10
prompts = [module.make_prompt(recipe) for recipe in recipes]
assert all(0 < len(prompt) <= module.MAX_PROMPT for prompt in prompts)
assert all('Точное блюдо:' in prompt and 'Без людей' in prompt for prompt in prompts)
assert len({recipe["id"] for recipe in recipes}) == 10
assert all(recipe["photo_status"] == "not_started" for recipe in recipes)
assert all(recipe["publication_status"] == "not_published" for recipe in recipes)

result = subprocess.run(
    [sys.executable, str(SCRIPT), "--start", "1", "--end", "10", "--limit", "10"],
    cwd=ROOT,
    text=True,
    capture_output=True,
    check=True,
)
summary = json.loads(result.stdout.strip().splitlines()[-1])
assert summary["mode"] == "dry-run"
assert summary["created_or_prepared"] == 10
assert summary["already_saved"] == 0
assert "GENERATED" not in result.stdout
print(json.dumps({
    "ok": True,
    "recipes": len(recipes),
    "unique_ids": len({recipe["id"] for recipe in recipes}),
    "prompts_within_500_chars": True,
    "dry_run_prepared": summary["created_or_prepared"],
    "paid_requests": 0,
}, ensure_ascii=False, indent=2))
