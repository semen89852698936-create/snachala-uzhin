#!/usr/bin/env python3
"""Checks operational handoff metadata, not the live site's current status."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
registry = json.loads((root / "project-operations/registry.json").read_text(encoding="utf-8"))
assert registry["schemaVersion"] == 1
assert registry["workingStateFile"] == "project-operations/CURRENT_STATE.md"
assert registry["recipeDataPlan"] == "project-operations/RECIPE_DATA_PLAN.md"
assert registry.get("handoffPolicy")
assert registry.get("autonomousWorkPolicy"), "Missing owner-authorized autonomous work rule"
policy = registry["autonomousWorkPolicy"]
assert policy["authorizedByOwnerOn"] == "2026-11-02"
assert policy["plannedCadence"] == "HOURLY"
assert policy["scheduleAutomationId"] == "6ae7ce56612c8191974f637ce197c946"
assert "FREQ=HOURLY" in policy["actualCadence"]
assert "24" not in policy["betweenConversations"], "Never promise literal 24/7 execution"
assert len(policy["requireOwnerApprovalFor"]) >= 4
assert registry.get("safety") == "Не публиковать и не менять production без проверки и явного разрешения."
assert len(registry["projects"]) >= 2
ids = [entry["id"] for entry in registry["projects"]]
assert len(ids) == len(set(ids)), "Duplicate project identifiers"
for item in registry["projects"]:
    assert item["repo"] and item["status"] in {"active", "paused", "blocked", "completed"}
    assert item["publicationPolicy"] == "No production deploy without explicit approval"
    assert item["nextActions"], "Each project needs a next action"
for file_name in [registry["workingStateFile"], registry["recipeDataPlan"]]:
    text = (root / file_name).read_text(encoding="utf-8")
    assert len(text) > 300, f"Empty/incomplete handoff: {file_name}"
    assert "production" in text.lower(), "Must distinguish production from staging"
handoff = (root / registry["workingStateFile"]).read_text(encoding="utf-8")
assert "2026-11-02" in handoff
assert "100" in handoff and "1001" in handoff
assert "не" in handoff.lower(), "Handoff must communicate limits and pending tasks"
print("PASS: operational registry, handoff, recipe data migration plan")
