import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from coverage import filter_items, has_publishable_assignment, overlap_report, prune_plan


class CoverageGateTests(unittest.TestCase):
    def setUp(self):
        self.accepted = [{
            "slug": "markets",
            "data": {
                "title": "Yields Spike, Summit Wraps, Loonie Slips",
                "sources": [
                    {"title": "Ottawa plans 'mega deduction' tax incentive to spur investment", "url": "https://example.com/mega"},
                    {"title": "Carney details plans to open up Canada's four largest airports to private investment", "url": "https://example.com/airports"},
                    {"title": "Home sales fall 6.9% annually in August as inflation, interest rate risks dampen market", "url": "https://example.com/homes"},
                    {"title": "Bond yields are rising. Are dividend stocks in trouble?", "url": "https://example.com/yields"},
                ],
            },
            "points": [
                "Bond yields are repricing borrowing costs quickly",
                "The Canada Investment Summit produced a major new business tax deduction",
                "Home sales fell sharply in August",
            ],
        }]

    def test_sep16_style_the_ten_recap_is_material_overlap(self):
        candidate = {
            "title": "Investment Summit Wraps as Bond Yields Surge",
            "sources": [
                {"title": "Ottawa plans 'mega deduction' tax incentive to spur investment", "url": "https://example.com/mega"},
                {"title": "Canada's 4 largest airports to be opened up to private investment", "url": "https://example.com/airports"},
                {"title": "August home sales down 6.9% as economic headwinds threaten market momentum", "url": "https://example.com/homes2"},
                {"title": "Shopify launches a new merchant lending product", "url": "https://example.com/shopify"},
            ],
        }
        points = [
            "Canada's new Mega Deduction reshapes business tax incentives",
            "Carney's airport privatization plan keeps public land ownership intact",
            "Home sales decline as economic headwinds build",
        ]
        report = overlap_report(candidate, points, self.accepted)
        self.assertTrue(report["material"])
        self.assertGreaterEqual(len(report["duplicateSources"]), 2)

    def test_filter_items_keeps_only_new_story_families(self):
        items = [
            {"title": "Home sales drop with fresh round of economic headwinds ahead: CREA", "url": "https://example.com/home-alt"},
            {"title": "Business Brief: Takeaways from the Canada Investment Summit", "url": "https://example.com/summit"},
            {"title": "Shopify launches a new merchant lending product", "url": "https://example.com/shopify"},
            {"title": "Air Canada names a new chief financial officer", "url": "https://example.com/ac"},
        ]
        kept = filter_items(items, self.accepted)
        self.assertEqual(
            [item["title"] for item in kept],
            ["Shopify launches a new merchant lending product", "Air Canada names a new chief financial officer"],
        )

    def test_prune_plan_removes_repeat_ownership_but_preserves_distinct_company_story(self):
        plan = {
            "owns": [
                {"event": "Home sales drop with fresh round of economic headwinds ahead: CREA", "owner": "companies"},
                {"event": "Shopify launches a new merchant lending product", "owner": "companies"},
            ],
            "callbacks": [],
            "elsewhere": [],
            "context": [],
        }
        pruned = prune_plan(plan, self.accepted)
        self.assertEqual([story["event"] for story in pruned["owns"]], ["Shopify launches a new merchant lending product"])
        self.assertTrue(any("Home sales" in story["event"] for story in pruned["elsewhere"]))
        self.assertTrue(has_publishable_assignment(pruned))

    def test_one_incidental_related_source_does_not_reject_an_otherwise_unique_section(self):
        candidate = {
            "title": "Three company moves worth knowing",
            "sources": [
                {"title": "Bond yields are rising. Are dividend stocks in trouble?", "url": "https://example.com/yields"},
                {"title": "Shopify launches a new merchant lending product", "url": "https://example.com/shopify"},
                {"title": "Air Canada names a new chief financial officer", "url": "https://example.com/ac"},
                {"title": "Nutrien expands a Saskatchewan potash project", "url": "https://example.com/nutrien"},
            ],
        }
        report = overlap_report(candidate, ["Shopify expands merchant financing"], self.accepted)
        self.assertFalse(report["material"])
        self.assertEqual(len(report["duplicateSources"]), 1)


if __name__ == "__main__":
    unittest.main()
