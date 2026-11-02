"""Offline checks for Yandex photo production; never charges the API."""
import base64
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, mock

from PIL import Image

SCRIPT = Path(__file__).with_name("generate_yandexart.py")
spec = importlib.util.spec_from_file_location("yandex_art_worker", SCRIPT)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class YandexProductionTests(TestCase):
    def test_manifest_is_actual_1001_recipes(self):
        items = worker.load_recipes()
        self.assertEqual(len(items), 1001)
        self.assertEqual([r["n"] for r in items[:3]], [1, 2, 3])
        self.assertIn("Говяжьи медальоны", items[20]["title"])
        self.assertTrue(all(len(worker.prompt(r)) <= 500 for r in items))
        self.assertTrue(any(r.get("ingredients") for r in items[:10]))

    def test_images_api_uses_correct_yandex_auth_headers(self):
        expected = b"some example image bytes"
        payload = json.dumps({"data": [{"b64_json": base64.b64encode(expected).decode()}]}).encode()
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): return None
            def read(self): return payload
        def transport(request, timeout):
            headers = dict(request.header_items())
            self.assertEqual(request.full_url, worker.API_URL)
            self.assertEqual(headers["Authorization"], "Api-Key fake-test-key")
            self.assertEqual(headers["Openai-project"], "example-folder")
            body = json.loads(request.data)
            self.assertEqual(body["model"], "art://example-folder/aliceai-image-art-3.0")
            self.assertEqual(body["size"], "1536x1024")
            self.assertLessEqual(len(body["prompt"]), 500)
            return Response()
        with mock.patch.object(worker.urllib.request, "urlopen", side_effect=transport):
            self.assertEqual(worker.request_image("food", "fake-test-key", "example-folder"), expected)

    def test_dry_run_first_ten_makes_no_paid_requests(self):
        with TemporaryDirectory() as tmp, mock.patch.object(worker, "request_image", side_effect=AssertionError("Paid call!")):
            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                worker.main(["--start", "1", "--end", "10", "--limit", "10", "--output", tmp])
            lines = stdout.getvalue().splitlines()
            self.assertEqual(sum('"would_generate": true' in line for line in lines), 10)
            self.assertFalse(list(Path(tmp).rglob("*.webp")))

    def test_execute_one_photo_webp_and_durable_record(self):
        image = io.BytesIO()
        Image.new("RGB", (1536, 1024), "#c6a481").save(image, "PNG")
        recipe = worker.load_recipes()[0]
        with TemporaryDirectory() as tmp:
            env = {"YANDEX_API_KEY": "test-key", "YANDEX_FOLDER_ID": "test-folder", "PHOTO_COST_APPROVED": "true"}
            with mock.patch.dict(os.environ, env), mock.patch.object(worker, "request_image", return_value=image.getvalue()):
                with contextlib.redirect_stdout(io.StringIO()):
                    worker.main(["--start", "1", "--end", "1", "--limit", "1", "--execute", "--output", tmp])
            dest = Path(tmp) / "photos" / f'0001-{recipe["id"]}.webp'
            record = Path(tmp) / "records" / f'0001-{recipe["id"]}.json'
            self.assertTrue(dest.exists())
            self.assertTrue(record.exists())
            with Image.open(dest) as im:
                self.assertEqual(im.size, (1200, 900))
                self.assertEqual(im.format, "WEBP")
            self.assertFalse(json.loads(record.read_text())["approved_for_publication"])
            self.assertFalse(list((Path(tmp) / "uncertain").glob("*.json")))


    def test_real_yandex_1216_by_832_is_valid(self):
        """Actual paid Yandex output from run 41431048307 must not be discarded."""
        source = io.BytesIO()
        Image.new("RGB", (1216, 832), "#d3ac84").save(source, "PNG")
        saved = worker.encode_webp(source.getvalue())
        with Image.open(io.BytesIO(saved)) as img:
            self.assertEqual(img.size, (1200, 900))
            self.assertEqual(img.format, "WEBP")

    def test_paid_raw_checkpoint_survives_postprocessing_error(self):
        """Do not pay a second time just because WebP conversion fails."""
        source = io.BytesIO()
        Image.new("RGB", (1216, 832), "#d3ac84").save(source, "PNG")
        recipe = worker.load_recipes()[0]
        args = ["--start", "1", "--end", "1", "--limit", "1", "--execute"]
        env = {
            "YANDEX_API_KEY": "fake-test-key",
            "YANDEX_FOLDER_ID": "test-folder",
            "PHOTO_COST_APPROVED": "true",
        }
        with TemporaryDirectory() as directory, mock.patch.dict(os.environ, env):
            target = args + ["--output", directory]
            with mock.patch.object(worker, "request_image", return_value=source.getvalue()) as paid, mock.patch.object(worker, "encode_webp", side_effect=RuntimeError("simulated converter error")):
                with self.assertRaisesRegex(RuntimeError, "simulated converter error"):
                    worker.main(target)
                paid.assert_called_once()
            raw = Path(directory) / "raw-checkpoint" / f'0001-{recipe["id"]}.png'
            self.assertTrue(raw.exists())
            with mock.patch.object(worker, "request_image", side_effect=AssertionError("Duplicate charge!")):
                with contextlib.redirect_stdout(io.StringIO()):
                    worker.main(target)
            output = Path(directory) / "photos" / f'0001-{recipe["id"]}.webp'
            self.assertTrue(output.exists())
            self.assertFalse(raw.exists())

    def test_known_failed_old_size_gate_can_be_recovered_once(self):
        source = io.BytesIO()
        Image.new("RGB", (1216, 832), "#d3ac84").save(source, "PNG")
        recipe = worker.load_recipes()[0]
        with TemporaryDirectory() as directory:
            parent = Path(directory)
            marker = parent / "uncertain" / f'0001-{recipe["id"]}.json'
            marker.parent.mkdir(parents=True)
            marker.write_text(json.dumps({"status": "known_response_discarded_by_old_size_gate"}))
            env = {
                "YANDEX_API_KEY": "fake-test-key",
                "YANDEX_FOLDER_ID": "test-folder",
                "PHOTO_COST_APPROVED": "true",
            }
            with mock.patch.dict(os.environ, env), mock.patch.object(worker, "request_image", return_value=source.getvalue()) as paid:
                with contextlib.redirect_stdout(io.StringIO()):
                    worker.main(["--start", "1", "--end", "1", "--limit", "1", "--execute", "--output", directory])
                paid.assert_called_once()
            self.assertFalse(marker.exists())

    def test_yandex_400_model_refusal_is_not_retried(self):
        """Explicit refusal is archived, leaving subsequent dishes to be generated."""
        import urllib.error
        err = urllib.error.HTTPError(worker.API_URL, 400, "Bad Request", {}, io.BytesIO(
            b'{"error":{"message":"\\u042f \\u043d\\u0435 \\u043c\\u043e\\u0433\\u0443 \\u0441\\u0433\\u0435\\u043d\\u0435\\u0440\\u0438\\u0440\\u043e\\u0432\\u0430\\u0442\\u044c \\u044d\\u0442\\u043e \\u0438\\u0437\\u043e\\u0431\\u0440\\u0430\\u0436\\u0435\\u043d\\u0438\\u0435."}}'))
        with mock.patch.object(worker.urllib.request, "urlopen", side_effect=err):
            with self.assertRaises(worker.ModelImageRefusal):
                worker.request_image("dish", "fake-key", "folder")

        item = worker.load_recipes()[0]
        args = ["--start", "1", "--end", "1", "--limit", "1", "--execute"]
        env = {"YANDEX_API_KEY": "fake", "YANDEX_FOLDER_ID": "folder", "PHOTO_COST_APPROVED": "true"}
        with TemporaryDirectory() as temp, mock.patch.dict(os.environ, env):
            refusal = worker.ModelImageRefusal("Yandex refused the photo prompt")
            with mock.patch.object(worker, "request_image", side_effect=refusal) as paid:
                with contextlib.redirect_stdout(io.StringIO()):
                    worker.main(args + ["--output", temp])
                paid.assert_called_once()
            rejected = Path(temp) / "rejected" / f'0001-{item["id"]}.json'
            self.assertEqual(json.loads(rejected.read_text())["status"], "refused_by_model")
            self.assertFalse(list((Path(temp) / "uncertain").glob("*.json")))
            with mock.patch.object(worker, "request_image", side_effect=AssertionError("Duplicate charge!")):
                with contextlib.redirect_stdout(io.StringIO()):
                    worker.main(args + ["--output", temp])

    def test_known_model_refusal_pending_is_archived_without_new_request(self):
        item = worker.load_recipes()[0]
        env = {"YANDEX_API_KEY": "fake", "YANDEX_FOLDER_ID": "folder", "PHOTO_COST_APPROVED": "true"}
        with TemporaryDirectory() as temp, mock.patch.dict(os.environ, env):
            pending = Path(temp) / "uncertain" / f'0001-{item["id"]}.json'
            pending.parent.mkdir(parents=True)
            pending.write_text(json.dumps({"status": "model_refusal_400_no_image"}))
            with mock.patch.object(worker, "request_image", side_effect=AssertionError("Must not call API")):
                with contextlib.redirect_stdout(io.StringIO()):
                    worker.main(["--start", "1", "--end", "1", "--limit", "1", "--execute", "--output", temp])
            self.assertFalse(pending.exists())
            self.assertTrue((Path(temp) / "rejected" / f'0001-{item["id"]}.json').exists())

    def test_missing_secrets_reject_paid_calls(self):
        with mock.patch.dict(os.environ, {"PHOTO_COST_APPROVED": "true"}, clear=True):
            with self.assertRaises(SystemExit):
                worker.main(["--start", "1", "--end", "1", "--limit", "1", "--execute"])
