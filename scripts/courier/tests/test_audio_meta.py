import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audio_meta import attach_duration, block_seconds, validate_duration_cap, write_feed


class AudioMetaTests(unittest.TestCase):
    def test_rss_prefers_measured_duration(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest_path = Path(directory) / "manifest.json"
            manifest = {"days": [{
                "date": "2026-09-14",
                "generatedAt": "2026-09-14T12:00:00+00:00",
                "blocks": [{
                    "id": "markets", "label": "Markets", "title": "Fixture",
                    "audio": "https://cdn.jsdelivr.net/gh/example/repo@abc/2026-09-14/markets.mp3",
                    "bytes": 100, "words": 1000, "durationSeconds": 65,
                    "talkingPoints": [], "script": "Fixture script",
                }],
            }]}
            write_feed(manifest, "example/repo", manifest_path)
            xml = manifest_path.with_name("feed.xml").read_text()
            self.assertIn("<itunes:duration>1:05</itunes:duration>", xml)
            self.assertEqual(block_seconds(manifest["days"][0]["blocks"][0]), 65)

    def test_word_count_is_only_fallback(self):
        self.assertEqual(block_seconds({"words": 140}), 60)
        with patch("audio_meta.duration_seconds", return_value=0):
            block = attach_duration({"words": 280}, "missing.mp3")
        self.assertEqual(block["durationSeconds"], 120)
        self.assertEqual(block["minutes"], 2)

    def test_measured_audio_overrides_word_estimate(self):
        with patch("audio_meta.duration_seconds", return_value=90.25):
            block = attach_duration({"words": 280}, "fixture.mp3")
        self.assertEqual(block["durationSeconds"], 90.25)
        self.assertEqual(block["minutes"], 1.5)

    def test_runtime_cap_uses_unrounded_audio_and_allows_short_editions(self):
        validate_duration_cap([{"durationSeconds": 1700}], 30)
        validate_duration_cap([{"durationSeconds": 900}, {"durationSeconds": 900}], 30)
        with self.assertRaisesRegex(ValueError, "exceeds the 30 min cap"):
            validate_duration_cap([{"durationSeconds": 900}, {"durationSeconds": 900.01}], 30)
        # Older editions keep their original budget during targeted repair.
        validate_duration_cap([{"durationSeconds": 2400}], 60)


if __name__ == "__main__":
    unittest.main()
