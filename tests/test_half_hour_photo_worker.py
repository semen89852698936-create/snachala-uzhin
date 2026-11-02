"""No-network regression tests for the half-hour photo producer."""
import hashlib
import json
import struct
import unittest
from unittest import mock

from scripts import half_hour_photo_worker as worker


def make_webp(width=1200, height=900):
    # Minimal VP8 RIFF container, sufficient for testing header parsing and hashes.
    chunk = (b"\x00\x00\x00" + b"\x9d\x01\x2a" +
             struct.pack("<HH", width, height) + b"\x00\x00")
    payload = b"VP8 " + struct.pack("<I", len(chunk)) + chunk
    return b"RIFF" + struct.pack("<I", len(payload) + 4) + b"WEBP" + payload


def make_manifest(content):
    digest = hashlib.sha256(content).hexdigest()
    items = []
    for n in range(1, 101):
        items.append({
            "number": n, "recipe_id": f"recipe-{n}",
            "title": f"Тестовый рецепт {n}",
            "file": f"photos/{n:03d}-test.webp",
            "sha256": digest if n == 1 else f"{n:064x}",
            "size": [1200, 900],
            "source_page": f"https://example.com/photos/{n}",
            "license": "CC BY-SA 4.0" if n % 2 else "CC0",
            "author": "See source page" if n % 2 else "Photographer",
            "exact_ingredient_match_verified": False,
        })
    return {"sources": items}


class PhotoWorkerTests(unittest.TestCase):
    def test_webp_valid_dimensions(self):
        b = make_webp(1200, 900)
        self.assertEqual(worker.dimensions_webp(b), (1200, 900))
        row = make_manifest(b)["sources"][0]
        r = worker.inspect_image(row, b)
        self.assertEqual(r["status"], "technical_pass")
        self.assertEqual(r["bytes"], len(b))

    def test_rejects_wrong_dimensions(self):
        row = make_manifest(make_webp())["sources"][0]
        with self.assertRaisesRegex(ValueError, "Dimensions mismatch"):
            worker.inspect_image(row, make_webp(500, 400))

    def test_rejects_bad_webp_signature(self):
        with self.assertRaisesRegex(ValueError, "Invalid RIFF"):
            worker.dimensions_webp(b"this is not a webp file")

    def test_rejects_wrong_sha(self):
        b = make_webp()
        row = make_manifest(b)["sources"][0]
        row["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            worker.inspect_image(row, b)

    def test_manifest_must_have_distinct_100(self):
        b = make_webp()
        manifest = make_manifest(b)
        self.assertEqual(len(worker.validate_manifest(manifest)), 100)
        manifest["sources"][1]["recipe_id"] = manifest["sources"][0]["recipe_id"]
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            worker.validate_manifest(manifest)

    def test_resume_changed_hash_and_failed_record(self):
        rows = worker.validate_manifest(make_manifest(make_webp()))
        checked = {
            "recipe-1": {"status": "technical_pass", "sha256": rows[0]["sha256"]},
            "recipe-2": {"status": "technical_pass", "sha256": "f" * 64},
            "recipe-3": {"status": "technical_fail", "sha256": rows[2]["sha256"]}
        }
        pending = worker.pending_photos(rows, checked, max_count=5)
        self.assertEqual([v["number"] for v in pending], [2, 4, 5, 6, 7])

    def test_review_queue_not_automatically_approved(self):
        rows = worker.validate_manifest(make_manifest(make_webp()))
        queue = worker.queue_entries(rows, {"recipe-1": {"status": "technical_pass"}})
        self.assertEqual(queue[0]["editorial_status"], "requires_visual_review")
        self.assertEqual(queue[0]["license_status"], "requires_individual_verification")
        self.assertIn("attribution_required", queue[0]["flags"])
        self.assertIn("share_alike_terms_require_review", queue[0]["flags"])
        self.assertEqual(queue[1]["flags"], ["ingredient_match_unverified"])

    def test_risk_signal_cannot_approve_image(self):
        rows = worker.validate_manifest(make_manifest(make_webp()))
        hint = {"recipe-1": {
            "severity": "high",
            "reason": "Описание страницы не подтверждает рецепт"
        }}
        queue = worker.queue_entries(rows, {}, hint)
        self.assertEqual(queue[0]["source_caption_risk"], "high")
        self.assertEqual(queue[0]["editorial_status"], "requires_visual_review")
        self.assertEqual(queue[0]["license_status"], "requires_individual_verification")
        self.assertIn("source_caption_requires_priority_review", queue[0]["flags"])
        self.assertEqual(queue[1]["source_caption_risk"], "not_flagged")

    def test_copied_recipe_title_does_not_prove_original_caption(self):
        rows = worker.validate_manifest(make_manifest(make_webp()))
        rows[0]["source_photo_title"] = rows[0]["title"]
        queue = worker.queue_entries(rows, {})
        self.assertIn("source_title_repeats_recipe_title_not_independent",
                      queue[0]["flags"])
        self.assertEqual(queue[0]["editorial_status"], "requires_visual_review")
        self.assertNotIn("source_title_repeats_recipe_title_not_independent",
                         queue[1]["flags"])

    def test_stale_photo_hash_does_not_read_as_technically_passed(self):
        rows = worker.validate_manifest(make_manifest(make_webp()))
        checked = {"recipe-1": {"status": "technical_pass", "sha256": "0" * 64}}
        queue = worker.queue_entries(rows, checked)
        self.assertEqual(queue[0]["technical_status"], "stale_sha_needs_recheck")

    def test_risk_manifest_matches_actual_photo_data(self):
        from pathlib import Path
        path = Path(__file__).resolve().parents[1] / "photo-library/editorial-risk-signals.json"
        report = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(report["schema_version"], 1)
        self.assertEqual(report["total_archive_candidates"], 100)
        self.assertEqual(report["flagged_by_source_title"], len(report["records"]))
        self.assertEqual(report["severe"] + report["moderate"], len(report["records"]))
        self.assertEqual(len(set(r["number"] for r in report["records"])), len(report["records"]))
        self.assertTrue(all(r["evidence_level"] == "source_title_only"
                            and r["status"] == "editorial_review_required_not_approved"
                            for r in report["records"]))

    def test_full_incremental_cycle_saves_only_in_review_branch(self):
        b = make_webp()
        manifest = make_manifest(b)
        manifest_bytes = json.dumps(manifest).encode("utf-8")
        def fetch_any(_repo, path, _ref, _token):
            if path.endswith("manifest.json"):
                return manifest_bytes, "manifest-blob"
            return b, "photo-blob"
        def find_optional(_repo, path, ref, _token):
            if path.endswith("manifest.json") and ref == "main":
                return manifest_bytes, "manifest-blob"
            return None
        with mock.patch.object(worker, "file_at", side_effect=fetch_any), \
             mock.patch.object(worker, "try_file_at", side_effect=find_optional), \
             mock.patch.object(worker, "ensure_checkpoint_branch") as ensure, \
             mock.patch.object(worker, "save_if_changed", return_value=True) as save, \
             mock.patch.object(worker, "load_editorial_signals", return_value={}):
            result = worker.execute("example/repo", "ephemeral-test-token", live=True)
        self.assertEqual(len(result["tested_this_run"]), 5)
        self.assertEqual(result["verified"], 1)  # only record 1 has the test photo's SHA
        self.assertEqual(len(result["saved"]), 2)
        self.assertEqual(result["checkpoint_branch"], "automation/half-hour-photo-audit")
        ensure.assert_called_once()
        self.assertEqual(save.call_count, 2)
        self.assertTrue(all(call.args[2].get("publication", "review_only") != "production"
                            for call in save.call_args_list))


if __name__ == "__main__":
    unittest.main()
