import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from completeness import expected_sections, gaps, needed_sections
from status import snapshot


class CompletenessTests(unittest.TestCase):
    def test_missing_commentary_is_partial_even_when_market_audio_exists(self):
        day = {"date": "2026-10-22", "generatedAt": "2026-10-22T11:00:00Z", "expectedSections": ["markets"],
               "blocks": [{"id": "markets", "audio": "markets.mp3", "commentaryUnavailable": True}]}
        self.assertEqual(needed_sections(day), ["markets"])
        self.assertEqual(snapshot("verified", day, day["date"])["state"], "partial")
        day["blocks"][0]["commentaryUnavailable"] = False
        self.assertEqual(needed_sections(day), [])

    def test_weekday_lessons_are_expected_and_weekend_lessons_are_not(self):
        self.assertEqual(expected_sections("2026-09-08", {"sports": {}}), ["lessons", "sports"])
        self.assertEqual(expected_sections("2026-09-12", {"sports": {}}), ["sports"])

    def test_verified_partial_is_never_complete(self):
        day = {"date":"2026-09-08", "generatedAt":"2026-09-08T12:00:00Z", "expectedSections":["markets", "sports"], "blocks":[{"id":"sports", "audio":"sports.mp3"}]}
        partial = snapshot("verified", day, day["date"])
        self.assertEqual(partial["state"], "partial")
        self.assertEqual(partial["missingSections"], ["markets"])
        day["blocks"].append({"id":"markets", "audio":""})
        self.assertEqual(snapshot("verified", day, day["date"])["state"], "partial")
        day["blocks"][-1]["audio"] = "markets.mp3"
        self.assertEqual(snapshot("verified", day, day["date"])["state"], "complete")
        self.assertIsNone(snapshot("updating", day, day["date"])["verifiedAt"])
