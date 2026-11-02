"""Offline tests for one-shot recovery. Absolutely no network or paid requests."""
import contextlib
import io
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, mock

from PIL import Image

import recover_missing_yandexart as recovery


class RecoveryTests(TestCase):
    def setUp(self):
        self._safe_mock_env = mock.patch.dict(os.environ, {
            "YANDEX_API_KEY": "offline-unit-test",
            "YANDEX_FOLDER_ID": "offline-test-folder",
            "PHOTO_COST_APPROVED": "true",
        })
        self._safe_mock_env.start()
        self.addCleanup(self._safe_mock_env.stop)
        self.recipes = {int(r["n"]): r for r in recovery.worker.load_recipes()}

    def sample_png(self):
        buffer = io.BytesIO()
        Image.new("RGB", (1216, 832), "#d9bc8e").save(buffer, "PNG")
        return buffer.getvalue()

    def create_marker(self, directory, kind, number):
        r = self.recipes[number]
        path = recovery.reservation_file(kind, r, directory)
        path.parent.mkdir(parents=True, exist_ok=True)
        status = "refused_by_model" if kind == "refused" else "request_pending_or_sent"
        path.write_text(json.dumps({"n": number, "status": status}))
        return path

    def test_refused_salad_fruit_prompt_and_reserve_only_once(self):
        with TemporaryDirectory() as d:
            marker = self.create_marker(d, "refused", 615)
            reservation = Path(d) / "selected.txt"
            with mock.patch.object(recovery.worker, "request_image", side_effect=AssertionError("Must not bill in prepare")):
                self.assertEqual(recovery.prepare("refused", reservation, d), 615)
            self.assertEqual(reservation.read_text(), "615")
            data = json.loads(marker.read_text())
            self.assertIn("рубиновыми", data["recovery_prompt"])
            self.assertNotIn("гранат", data["recovery_prompt"].lower())
            self.assertEqual(recovery.prepare("refused", reservation, d), None)
            self.assertEqual(reservation.read_text(), "NONE")

    def test_refused_recovery_saves_photo_and_does_not_repeat(self):
        with TemporaryDirectory() as d:
            marker = self.create_marker(d, "refused", 615)
            reservation = Path(d) / "selected.txt"
            recovery.prepare("refused", reservation, d)
            png = self.sample_png()
            with mock.patch.dict(os.environ, {"YANDEX_API_KEY":"test","YANDEX_FOLDER_ID":"test-folder","PHOTO_COST_APPROVED":"true"}):
                with mock.patch.object(recovery.worker, "request_image", return_value=png) as paid:
                    recovery.perform("refused", reservation, d)
                    paid.assert_called_once()
                self.assertFalse(marker.exists())
                photo, record, raw = recovery.dest_files(self.recipes[615], d)
                self.assertTrue(photo.exists())
                self.assertFalse(raw.exists())
                self.assertEqual(json.loads(record.read_text())["recovered_after"], "refused")
                self.assertFalse(json.loads(record.read_text())["approved_for_publication"])
                self.assertEqual(recovery.prepare("refused", reservation, d), None)

    def test_uncertain_recovery_records_possible_duplicate_charge(self):
        with TemporaryDirectory() as d:
            marker = self.create_marker(d, "uncertain", 546)
            reservation = Path(d) / "selected.txt"
            recovery.prepare("uncertain", reservation, d)
            self.assertTrue(json.loads(marker.read_text())["recovery_possible_duplicate_charge"])
            with mock.patch.object(recovery.worker, "request_image", return_value=self.sample_png()) as paid:
                recovery.perform("uncertain", reservation, d)
                paid.assert_called_once()
            photo, record, raw = recovery.dest_files(self.recipes[546], d)
            self.assertTrue(photo.exists())
            self.assertFalse(marker.exists())
            self.assertTrue(json.loads(record.read_text())["previous_request_may_have_been_billed"])

    def test_refused_twice_stays_marked_and_never_retries(self):
        with TemporaryDirectory() as d:
            marker = self.create_marker(d, "refused", 615)
            reservation = Path(d) / "selected.txt"
            recovery.prepare("refused", reservation, d)
            with mock.patch.object(recovery.worker, "request_image", side_effect=recovery.worker.ModelImageRefusal("No")):
                recovery.perform("refused", reservation, d)
            self.assertEqual(json.loads(marker.read_text())["recovery_result"], "refused_again")
            self.assertEqual(recovery.prepare("refused", reservation, d), None)

    def test_failed_request_is_reserved_and_not_repeated(self):
        with TemporaryDirectory() as d:
            marker = self.create_marker(d, "uncertain", 546)
            reservation = Path(d) / "selected.txt"
            recovery.prepare("uncertain", reservation, d)
            with mock.patch.object(recovery.worker, "request_image", side_effect=ConnectionError("network")):
                with self.assertRaises(ConnectionError):
                    recovery.perform("uncertain", reservation, d)
            self.assertIn("recovery_attempt_reserved_at", json.loads(marker.read_text()))
            self.assertEqual(recovery.prepare("uncertain", reservation, d), None)
