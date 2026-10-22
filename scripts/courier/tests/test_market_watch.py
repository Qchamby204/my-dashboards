import json
import sys
import unittest
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from market_watch import render_watch, EMPTY, MAX_WORDS
from market_snapshot import narrate


class WatchTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.fromisoformat("2026-10-21T10:17:00+00:00")
        self.event = {"name": "Fixture release", "date": "2026-10-22", "why": "It can change the inflation outlook.",
                      "source": "https://www.statcan.gc.ca/fixture-schedule"}
        self.sources = [{"url": self.event["source"]}]

    def render(self, entries):
        return render_watch(json.dumps(entries), "2026-10-21", self.sources, now=self.now)

    def test_cited_upcoming_event_has_date_mechanism_and_word_cap(self):
        text, accepted = self.render([self.event])
        self.assertEqual(accepted, [self.event])
        self.assertIn("Statistics Canada", text)
        self.assertIn("October 22", text)
        self.assertIn(self.event["why"], text)
        self.assertLessEqual(len(text.split()), MAX_WORDS)

    def test_invalid_past_distant_uncited_and_nonprimary_items_are_omitted(self):
        for changes in ({"date": "2026-10-20"}, {"date": "2026-11-01"}, {"date": "bad"},
                        {"source": "https://example.com/news"}, {"source": "https://statcan.gc.ca.evil.test/schedule"},
                        {"source": "https://www.statcan.gc.ca/uncited"}, {"date": "2026-10-21"}):
            with self.subTest(changes=changes):
                self.assertEqual(self.render([{**self.event, **changes}]), (EMPTY, []))
        for raw in (None, "not JSON", '{}', '[]'):
            self.assertEqual(render_watch(raw, "2026-10-21", self.sources, now=self.now), (EMPTY, []))

    def test_todays_event_needs_verified_time_and_is_rejected_after_release(self):
        event = {**self.event, "date": "2026-10-21", "time": "08:30", "timezone": "America/Toronto"}
        self.assertEqual(self.render([event])[1], [event])
        after = datetime.fromisoformat("2026-10-21T13:00:00+00:00")
        self.assertEqual(render_watch([event], "2026-10-21", self.sources, now=after), (EMPTY, []))
        for changes in ({"time": "25:00"}, {"timezone": "bogus"}):
            self.assertEqual(self.render([{**event, **changes}]), (EMPTY, []))

    def test_duplicate_and_overlong_events_are_not_padded_or_cut_mid_sentence(self):
        self.assertEqual(len(self.render([self.event, self.event])[1]), 1)
        text, accepted = self.render([{**self.event, "why": "word " * 60}])
        self.assertEqual((text, accepted), (EMPTY, []))


class StyleTests(unittest.TestCase):
    def snapshot(self, right_date="2026-10-20", right_from="2026-10-19"):
        return {"editionDate": "2026-10-21", "unavailable": [], "observations": [
            {"symbol": "IWM", "kind": "style", "day": 1.2, "asOf": "2026-10-20", "dayFrom": "2026-10-19"},
            {"symbol": "IWB", "kind": "style", "day": 0.5, "asOf": right_date, "dayFrom": right_from},
            {"symbol": "IWD", "kind": "style", "day": -0.3, "asOf": "2026-10-20", "dayFrom": "2026-10-19"},
            {"symbol": "IWF", "kind": "style", "day": 0.4, "asOf": "2026-10-20", "dayFrom": "2026-10-19"}]}

    def test_style_spreads_are_percentage_points_and_explicitly_us_proxies(self):
        text = narrate(self.snapshot())
        self.assertIn("U.S. small companies led U.S. large and mid-sized companies by 0.70 percentage points", text)
        self.assertIn("U.S. value stocks lagged U.S. growth stocks by 0.70 percentage points", text)
        self.assertIn("not isolated factor returns or an attribution of D F A X", text)

    def test_mismatched_sessions_are_not_compared(self):
        for dates in (("2026-10-19", "2026-10-16"), ("2026-10-20", "2026-10-16")):
            text = narrate(self.snapshot(*dates))
            self.assertNotIn("U.S. small companies led", text)
            self.assertIn("U.S. value stocks lagged", text)


if __name__ == "__main__":
    unittest.main()
