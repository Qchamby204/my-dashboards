import tempfile
import unittest
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audio_meta import block_seconds, write_feed


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
        self.assertEqual(block_seconds({"words": 150}), 60)


if __name__ == "__main__":
    unittest.main()
