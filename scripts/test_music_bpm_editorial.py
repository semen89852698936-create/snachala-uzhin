"""Regression checks for the three BPM editorial phases and their visual cards."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "music/verified-bpm-editorial.json").read_text(encoding="utf-8"))
BANDS = {"cooking": (120, float("inf")), "dinner": (80, 100), "continue": (0, 80)}
PHASES = {"cooking": "kitchen", "dinner": "dinner", "continue": "continue"}

class MusicBpmEditorialTests(unittest.TestCase):
    def test_every_sourced_track_meets_required_band(self):
        self.assertEqual(set(DATA["lists"]), set(BANDS))
        for phase, records in DATA["lists"].items():
            low, high = BANDS[phase]
            self.assertGreater(len(records), 0)
            seen = set()
            for record in records:
                with self.subTest(phase=phase, track=record["title"]):
                    self.assertTrue(low <= record["bpm"] <= high)
                    self.assertTrue(record["source"].startswith("https://"))
                    identity = (record["title"].casefold(), record["artist"].casefold())
                    self.assertNotIn(identity, seen)
                    seen.add(identity)

    def test_site_and_catalog_have_matching_visual_cards(self):
        expected_total = sum(map(len, DATA["lists"].values()))
        for path in [ROOT / "index.html", ROOT / "full-catalog/index.html"]:
            html = path.read_text(encoding="utf-8")
            with self.subTest(path=str(path)):
                self.assertEqual(html.count('class="du-bpm-track"'), expected_total)
                self.assertEqual(html.count('class="du-bpm-track-list"'), 3)
                self.assertEqual(html.count('class="du-music-spotify-extra"'), 3)
                for phase, records in DATA["lists"].items():
                    marker = '<article class="du-music-card" data-music-phase="' + PHASES[phase] + '">'
                    self.assertIn(marker, html)
                    card = html.split(marker, 1)[1].split("</article>", 1)[0]
                    self.assertEqual(card.count('class="du-bpm-track"'), len(records))
                    for record in records:
                        self.assertIn(f'>{record["bpm"]} BPM</span>', card)

    def test_do_not_claim_existing_spotify_playlists_are_synchronized(self):
        self.assertEqual(DATA["verificationStatus"], "partial")
        self.assertIn("not been edited", DATA["streamingStatus"])

if __name__ == "__main__":
    unittest.main()
