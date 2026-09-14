import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from retire_frontpage import retire


class RetireFrontpageTests(unittest.TestCase):
    def test_retire_removes_frontpage_from_manifest_and_feed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / "manifest.json"
            feed = root / "feed.xml"
            manifest.write_text(json.dumps({"days": [{
                "date": "2026-09-14",
                "expectedSections": ["frontpage", "lessons", "markets"],
                "missingSections": ["frontpage"],
                "voiceless": ["frontpage"],
                "failed": ["frontpage"],
                "plannedMinutes": 60,
                "projectedMinutes": 7.5,
                "blocks": [
                    {"id": "frontpage", "minutes": 3.0},
                    {"id": "markets", "minutes": 4.5},
                ],
            }]}))
            feed.write_text("""<rss><channel>
<item><title>Front</title><guid>courier-2026-09-14-frontpage</guid></item>
<item><title>Markets</title><guid>courier-2026-09-14-markets</guid></item>
</channel></rss>""")

            self.assertTrue(retire(manifest, feed))
            day = json.loads(manifest.read_text())["days"][0]
            self.assertEqual([b["id"] for b in day["blocks"]], ["markets"])
            self.assertEqual(day["expectedSections"], ["lessons", "markets"])
            self.assertEqual(day["missingSections"], [])
            self.assertEqual(day["voiceless"], [])
            self.assertEqual(day["failed"], [])
            self.assertEqual(day["plannedMinutes"], 57)
            self.assertEqual(day["projectedMinutes"], 4.5)
            self.assertNotIn("frontpage", feed.read_text())
            self.assertIn("markets", feed.read_text())


if __name__ == "__main__":
    unittest.main()
