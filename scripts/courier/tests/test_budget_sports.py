"""Budget and sports coverage regression tests with no paid or network calls."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from allocation import adaptive_minutes
from sports import balanced_sports_items

with patch.dict(sys.modules, {name: types.ModuleType(name) for name in ("requests", "feedparser")}):
    spec = importlib.util.spec_from_file_location("courier_budget_test", HERE / "build.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)


class BudgetSportsTests(unittest.TestCase):
    def test_default_budget_includes_lessons_and_busy_sections(self):
        sources = {slug: {} for slug in builder.DEFAULT_MINUTES}
        plan = {slug: {"owns": [{"event": "Fixture"}] * 12} for slug in sources}
        items = {slug: [{"title": "Fixture"}] * 40 for slug in sources}
        minutes, _, _ = adaptive_minutes(sources, plan, items)
        self.assertLessEqual(sum(minutes.values()) + builder.LESSONS_MINUTES, 30)
        self.assertGreater(minutes["sports"], 0)

    def test_both_priority_leagues_survive_a_hockey_heavy_source_window(self):
        hockey = [{"outlet": "ESPN NHL", "title": f"Hockey story {i}"} for i in range(50)]
        football = [{"outlet": "ESPN NFL", "title": f"Football story {i}"} for i in range(30)]
        raiders = {"outlet": "ESPN NFL", "title": "Raiders injury update"}
        items = hockey + football + [raiders, {"outlet": "CBC", "title": "Blue Bombers win"}]
        ordered = balanced_sports_items(items)
        self.assertEqual(ordered[0], raiders)
        self.assertTrue(any(item in football for item in ordered[:10]))
        self.assertTrue(any(item in hockey for item in ordered[:10]))
        self.assertEqual(sorted(map(id, ordered)), sorted(map(id, items)))

    def test_failed_shortening_cannot_narrate_an_over_budget_draft(self):
        data = {"script": "Source reports this first story. " * 40 + "\n\nTalking points\n- Original point",
                "title": "Fixture", "sources": [{"outlet": "Fixture", "title": "Fixture", "url": "https://example.com"}], "task": "Original task"}
        with patch.object(builder, "DRY_RUN", False), patch.object(builder, "claude", side_effect=RuntimeError("Fixture failure")) as api:
            result = builder.enforce_length(data, 1)
        body, points = builder.split_talking_points(result["script"])
        self.assertLessEqual(len(body.split()), builder.words_for(1))
        self.assertTrue(body.endswith("."))
        self.assertEqual(points, ["Original point"])
        self.assertEqual(result["task"], data["task"])
        self.assertEqual(result["sources"], data["sources"])
        self.assertEqual(api.call_count, 1)

    def test_successful_shortening_preserves_sources_and_practice_metadata(self):
        data = {"script": "Long fixture sentence. " * 80, "title": "Original", "sources": [], "task": "Task", "drill": "Drill"}
        shorter = "A shorter complete fixture sentence. " * 10
        with patch.object(builder, "DRY_RUN", False), patch.object(builder, "claude", return_value="TITLE: Replacement\nSCRIPT:\n" + shorter + "\nSOURCES:\n- ignored | ignored | https://example.com"):
            result = builder.enforce_length(data, 1)
        self.assertEqual(result["script"], shorter.strip())
        self.assertEqual({k: v for k, v in result.items() if k != "script"}, {k: v for k, v in data.items() if k != "script"})


if __name__ == "__main__":
    unittest.main()
