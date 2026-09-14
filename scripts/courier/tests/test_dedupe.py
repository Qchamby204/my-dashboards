import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dedupe import filter_plan, history_prompt, near_duplicate, recent_events


class DedupeTests(unittest.TestCase):
    def test_exact_and_near_repeat_are_duplicates(self):
        self.assertTrue(near_duplicate(
            "Bank of Canada holds policy rate at 3%",
            "Bank of Canada holds the policy rate at 3%",
        ))
        self.assertTrue(near_duplicate(
            "Ottawa announces new housing tax credit for first-time buyers",
            "Ottawa announces a new housing tax credit for first time buyers",
        ))

    def test_changed_number_is_new_context(self):
        self.assertFalse(near_duplicate(
            "Bank of Canada holds policy rate at 3%",
            "Bank of Canada cuts policy rate to 2.75%",
        ))

    def test_filter_removes_repeat_everywhere_in_plan(self):
        repeated = {"event": "Bank of Canada holds policy rate at 3%"}
        fresh = {"event": "New CRA trust reporting rules take effect"}
        plan = {
            "markets": {"owns": [repeated], "callbacks": [], "elsewhere": [], "context": []},
            "practice": {"owns": [fresh], "callbacks": [], "elsewhere": [repeated], "context": []},
        }
        history = [{"date": "2026-09-11", "owner": "markets", "event": repeated["event"]}]
        filtered, dropped = filter_plan(plan, history)
        self.assertEqual(dropped, [repeated["event"]])
        self.assertEqual(filtered["markets"]["owns"], [])
        self.assertEqual(filtered["practice"]["elsewhere"], [])
        self.assertEqual(filtered["practice"]["owns"], [fresh])

    def test_recent_history_excludes_current_edition_and_frontpage(self):
        manifest = {"days": [
            {"date": "2026-09-14", "plan": [{"event": "Current story", "owner": "markets"}]},
            {"date": "2026-09-11", "plan": [{"event": "Prior story", "owner": "sports"}]},
            {"date": "2026-09-10", "blocks": [
                {"id": "frontpage", "title": "Old summary"},
                {"id": "markets", "title": "Older market story"},
            ]},
        ]}
        events = recent_events(manifest, "2026-09-14")
        self.assertEqual([e["event"] for e in events], ["Prior story", "Older market story"])
        self.assertIn("MATERIAL NEW CONTEXT", history_prompt(events))


if __name__ == "__main__":
    unittest.main()
