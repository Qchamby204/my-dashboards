import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from completeness import expected_sections, gaps
from status import snapshot


class CompletenessTests(unittest.TestCase):
    def test_weekday_lessons_are_expected_and_weekend_lessons_are_not(self):
        self.assertEqual(expected_sections("2026-09-08", {"sports": {}}), ["frontpage", "lessons", "sports"])
        self.assertEqual(expected_sections("2026-09-12", {"sports": {}}), ["frontpage", "sports"])

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
