#!/usr/bin/env python3
"""Regression checks for СНАЧАЛА УЖИН multilingual music credits and playback rights."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class LicensedRussianMusic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((ROOT / "music/native-player-manifest.json").read_text())
        cls.intake = json.loads((ROOT / "music/russian-licensed-intake-20261112.json").read_text())
        cls.credits = (ROOT / "music/credits.html").read_text()
        cls.player = (ROOT / "assets/native-music-player-20261112.js").read_text()

    def test_manifest_is_json_with_three_unbounded_playlists(self):
        assert self.manifest["phaseOrder"] == ["kitchen", "dinner", "after"]
        assert len(self.manifest["playlists"]["dinner"]["tracks"]) > 20
        self.assertNotRegex(self.player, r"slice\(0,\s*20\)|Math\.min\(20|length\s*<\s*20")

    def test_credits_exactly_match_live_tracks(self):
        names = {"kitchen": "Под что готовить", "dinner": "Под что ужинать", "after": "Под что продолжить"}
        ids = set()
        for key, phase in self.manifest["playlists"].items():
            tracks = phase["tracks"]
            self.assertTrue(tracks)
            expected = len(tracks)
            section = re.search(
                r"<h2>" + re.escape(names[key]) + r" <small>\((\d+)\)</small></h2><ol>(.*?)</ol></section>",
                self.credits, re.S,
            )
            self.assertIsNotNone(section, key)
            self.assertEqual(expected, int(section.group(1)), key)
            self.assertEqual(expected, section.group(2).count("<li>"), key)
            for track in tracks:
                self.assertNotIn(track["id"], ids)
                ids.add(track["id"])
                self.assertTrue(track["license"]["streamingAllowed"], track["id"])
                self.assertTrue(track["license"]["creditRequired"], track["id"])
                self.assertTrue(track["src"].startswith("https://"), track["id"])
                self.assertTrue(track["source"].startswith("https://"), track["id"])

    def test_russian_rights_and_tempo_gates(self):
        all_tracks = [t for phase in self.manifest["playlists"].values() for t in phase["tracks"]]
        active_ids = {t["id"] for t in all_tracks}
        new_tracks = [t for t in all_tracks if t["id"].startswith(("tunguska-cc-", "naumenko-impression-"))]
        self.assertEqual(9, len(new_tracks))
        self.assertEqual(43, len(self.intake["tracks"]))
        for rec in self.intake["tracks"]:
            if rec["collection"].startswith("dark-antey"):
                self.assertFalse(rec["audible"])
                self.assertNotIn(rec["id"], active_ids)
            if rec.get("tempoSuggestedPlaylist") is None or rec["id"] == "tunguska-cc-04":
                self.assertNotIn(rec["id"], active_ids)
        for key, phase in self.manifest["playlists"].items():
            for t in phase["tracks"]:
                if not t["id"].startswith(("tunguska-cc-", "naumenko-impression-")):
                    continue
                self.assertIn("CC-BY-SA", t["license"]["id"])
                self.assertIsInstance(t["bpm"], int)
                if key == "kitchen": self.assertGreaterEqual(t["bpm"], 120)
                if key == "dinner": self.assertTrue(80 <= t["bpm"] <= 100)
                if key == "after": self.assertLessEqual(t["bpm"], 80)
                self.assertIn(t["title"].replace("&", "&amp;"), self.credits)

    def test_no_user_facing_bpm_in_player_songline(self):
        self.assertIn("data-np-inline-track", self.player)
        self.assertIn("artist:item.artist||'Kevin MacLeod'", self.player)


if __name__ == "__main__":
    unittest.main()
