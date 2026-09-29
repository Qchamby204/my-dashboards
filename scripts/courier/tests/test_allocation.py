import sys
import unittest
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from allocation import adaptive_minutes


class AllocationTests(unittest.TestCase):
    def test_full_weekday_and_weekend_fit_thirty_minutes(self):
        sources = json.loads((Path(__file__).resolve().parents[1] / "sources.json").read_text())
        plan = {slug: {"owns": [{"event": f"{slug} news"}], "callbacks": []} for slug in sources}
        items = {slug: [{"title": str(i)} for i in range(40)] for slug in sources}
        for weekday in (True, False):
            with self.subTest(weekday=weekday):
                minutes, skipped, _ = adaptive_minutes(sources, plan, items, weekday=weekday)
                self.assertLessEqual(sum(minutes.values()) + (8 if weekday else 0), 30)
                self.assertEqual(skipped, [])

    def test_quiet_section_can_be_skipped_and_time_moves_to_busy_sections(self):
        sources = {
            "markets": {"minutes": 8},
            "practice": {"minutes": 7},
            "parenting": {"minutes": 2},
        }
        plan = {
            "markets": {"owns": [{"event": str(i)} for i in range(6)], "callbacks": []},
            "practice": {"owns": [{"event": str(i)} for i in range(3)], "callbacks": []},
            "parenting": {"owns": [], "callbacks": []},
        }
        items = {
            "markets": [{"title": str(i)} for i in range(20)],
            "practice": [{"title": str(i)} for i in range(8)],
            "parenting": [],
        }
        minutes, skipped, scores = adaptive_minutes(
            sources, plan, items, total_minutes=22, lessons_minutes=8, weekday=True,
        )
        self.assertIn("parenting", skipped)
        self.assertEqual(minutes["parenting"], 0)
        self.assertGreater(minutes["markets"], minutes["practice"])
        self.assertLessEqual(sum(minutes.values()), 14)
        self.assertGreater(scores["markets"], scores["practice"])

    def test_all_quiet_sections_can_all_skip(self):
        sources = {"health": {"minutes": 3}, "parenting": {"minutes": 2}}
        plan = {slug: {"owns": [], "callbacks": []} for slug in sources}
        minutes, skipped, _ = adaptive_minutes(sources, plan, {slug: [] for slug in sources})
        self.assertEqual(set(skipped), set(sources))
        self.assertEqual(sum(minutes.values()), 0)

    def test_the_ten_cannot_buy_airtime_with_feed_volume_when_it_owns_nothing(self):
        sources = {
            "markets": {"minutes": 8},
            "companies": {"minutes": 7, "mode": "companies"},
        }
        plan = {
            "markets": {"owns": [{"event": "Rates move"}], "callbacks": []},
            "companies": {"owns": [], "callbacks": []},
        }
        items = {
            "markets": [{"title": "Rates move"}],
            "companies": [{"title": f"Company headline {i}"} for i in range(40)],
        }
        minutes, skipped, scores = adaptive_minutes(sources, plan, items, total_minutes=20, lessons_minutes=8)
        self.assertEqual(scores["companies"], 0)
        self.assertEqual(minutes["companies"], 0)
        self.assertIn("companies", skipped)


if __name__ == "__main__":
    unittest.main()
