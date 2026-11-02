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

    def test_missing_secrets_reject_paid_calls(self):
        with mock.patch.dict(os.environ, {"PHOTO_COST_APPROVED": "true"}, clear=True):
            with self.assertRaises(SystemExit):
                worker.main(["--start", "1", "--end", "1", "--limit", "1", "--execute"])
