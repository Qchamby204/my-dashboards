import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from planning import resilient_plan, same_topic


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
            "companies": [{"title": "Shopify launches a new merchant lending product"}],
        }
        plan, method, dropped = resilient_plan(courier, sources, items, [])
        self.assertEqual(method, "deterministic")
        all_owned = [s["event"] for b in plan.values() for s in b["owns"]]
        self.assertEqual(sum("Bank of Canada" in event for event in all_owned), 1)
        self.assertIn("CRA changes trust reporting rules", all_owned)
        self.assertEqual([s["event"] for s in plan["companies"]["owns"]], ["Shopify launches a new merchant lending product"])
        self.assertEqual(plan["companies"]["context"], [])
        self.assertTrue(any("Bank of Canada" in s["event"] for s in plan["companies"]["elsewhere"]))
        self.assertEqual(dropped, [])
        self.assertTrue(any("deterministic" in line for line in logs))

    def test_daily_event_family_collapses_different_headline_wording(self):
        self.assertTrue(same_topic(
            "Home sales fall 6.9% annually in August as inflation, interest rate risks dampen market",
            "Home sales drop with fresh round of economic headwinds ahead: CREA",
        ))
        self.assertTrue(same_topic(
            "How deal making gets done at the Canada Investment Summit",
            "Teck CEO calls for more investment in crucial mining infrastructure at investment summit",
        ))
        self.assertTrue(same_topic(
            "Bond yields are rising. Are dividend stocks in trouble?",
            "Inflation holds at 3%, but bond yields set the agenda",
        ))
        self.assertFalse(same_topic(
            "Winnipeg Jets sign a veteran defenceman",
            "Bank of Canada holds its policy rate",
        ))

    def test_primary_plan_gets_distinct_company_stories_instead_of_recap_context(self):
        sources = {
            "markets": {"mode": "news"},
            "companies": {"mode": "companies"},
        }
        primary = {
            "markets": {
                "owns": [{"event": "Home sales fall in August", "owner": "markets", "line": "Home sales fall in August", "callbacks": []}],
                "callbacks": [], "elsewhere": [], "context": [],
            },
            "companies": {"owns": [], "callbacks": [], "elsewhere": [], "context": []},
        }
        courier = SimpleNamespace(
            TODAY="2026-09-16",
            plan_stories=lambda *args: primary,
            log=lambda *args: None,
        )
        items = {
            "markets": [{"title": "Home sales fall in August"}],
            "companies": [
                {"title": "Home sales drop in August"},
                {"title": "Shopify launches a new merchant lending product"},
                {"title": "Air Canada names a new chief financial officer"},
            ],
        }
        plan, method, _ = resilient_plan(courier, sources, items, [])
        self.assertEqual(method, "primary")
        company_events = [s["event"] for s in plan["companies"]["owns"]]
        self.assertIn("Shopify launches a new merchant lending product", company_events)
        self.assertIn("Air Canada names a new chief financial officer", company_events)
        self.assertFalse(any("Home sales" in event for event in company_events))
        self.assertEqual(plan["companies"]["context"], [])
        self.assertTrue(any("Home sales" in s["event"] for s in plan["companies"]["elsewhere"]))


if __name__ == "__main__":
    unittest.main()
