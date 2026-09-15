import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from planning import resilient_plan


class PlanningTests(unittest.TestCase):
    def test_double_planner_failure_uses_deterministic_ownership(self):
        logs = []
        courier = SimpleNamespace(
            TODAY="2026-09-14",
            plan_stories=lambda *args: (_ for _ in ()).throw(RuntimeError("primary down")),
            claude=lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("retry down")),
            parse_plan=lambda raw: [],
            log=logs.append,
        )
        sources = {
            "markets": {"mode": "news"},
            "practice": {"mode": "news"},
            "companies": {"mode": "companies"},
        }
        same = "Bank of Canada holds policy rate at 3%"
        items = {
            "markets": [{"title": same}],
            "practice": [{"title": "Bank of Canada holds the policy rate at 3%"}, {"title": "CRA changes trust reporting rules"}],
            "companies": [{"title": "Company fixture"}],
        }
        plan, method, dropped = resilient_plan(courier, sources, items, [])
        self.assertEqual(method, "deterministic")
        self.assertEqual(len(plan["markets"]["owns"]), 1)
        self.assertEqual([s["event"] for s in plan["practice"]["owns"]], ["CRA changes trust reporting rules"])
        self.assertEqual(len(plan["companies"]["context"]), 2)
        self.assertEqual(dropped, [])
        self.assertTrue(any("deterministic" in line for line in logs))


if __name__ == "__main__":
    unittest.main()
