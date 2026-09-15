import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from source_health import SourceHealth, fetch_items


class FakeParser:
    def __init__(self, entries):
        self.entries = entries

    def parse(self, url, request_headers=None):
        return SimpleNamespace(entries=self.entries, bozo=False)


class SourceHealthTests(unittest.TestCase):
    def test_stale_and_undated_items_are_not_promoted(self):
        now = datetime.now(timezone.utc)
        fresh = (now - timedelta(hours=2)).timetuple()
        stale = (now - timedelta(days=3)).timetuple()
        entries = [
            {"title": "Fresh", "link": "https://example.com/fresh", "summary": "Fresh item", "published_parsed": fresh},
            {"title": "Old", "link": "https://example.com/old", "summary": "Old item", "published_parsed": stale},
            {"title": "Undated", "link": "https://example.com/undated", "summary": "No date"},
        ]
        health = SourceHealth()
        feeds = [{"outlet": "Fixture", "url": "https://example.com/feed"}]
        items = fetch_items(feeds, FakeParser(entries), health=health)
        self.assertEqual([item["title"] for item in items], ["Fresh"])
        record = health.feeds[0]
        self.assertEqual(record["freshEntries"], 1)
        self.assertEqual(record["staleEntries"], 1)
        self.assertEqual(record["undatedDropped"], 1)

    def test_section_report_flags_empty_coverage(self):
        health = SourceHealth()
        health.record_feed(outlet="Fixture", url="https://example.com/feed", status="ok", totalEntries=3,
                           freshEntries=0, staleEntries=2, undatedDropped=1, error="")
        sources = {"health": {"feeds": [{"outlet": "Fixture", "url": "https://example.com/feed"}]}}
        report = health.report(sources)
        self.assertIn("health", report["degradedSections"])
        self.assertTrue(report["sections"]["health"]["degraded"])


if __name__ == "__main__":
    unittest.main()
