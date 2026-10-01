"""Duration regressions use synthetic scripts and never call a model, voice, or feed API."""
import importlib.util
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))


def load_builder(minutes=None):
    with patch.dict(sys.modules, {name: types.ModuleType(name) for name in ("requests", "feedparser")}), \
            patch.dict(os.environ, {"DRY_RUN": ""}):
        os.environ.pop("COURIER_MINUTES", None)
        if minutes is not None:
            os.environ["COURIER_MINUTES"] = minutes
        spec = importlib.util.spec_from_file_location("duration_builder", HERE / "build.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module


builder = load_builder()
with patch.dict(sys.modules, {"build": builder}):
    spec = importlib.util.spec_from_file_location("duration_runner", HERE / "run.py")
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)


def script(words):
    return " ".join(f"word{i}" for i in range(words)) + "."


class DurationTests(unittest.TestCase):
    def setUp(self):
        self.tail = "\n\nTalking points\n- Saved point\n"
        self.data = {
            "title": "Synthetic news", "script": script(150) + self.tail,
            "sources": [{"outlet": "Fixture", "title": "Original source", "url": "https://example.com/a"}],
            "task": "Keep task", "drill": "Keep drill",
        }

    def test_unset_and_empty_duration_default_to_sixty_minutes(self):
        for setting in (None, ""):
            with self.subTest(setting=setting):
                default_builder = load_builder(setting)
                self.assertEqual(default_builder.TOTAL_MINUTES, 60)
                self.assertIn("capped at 60 minutes", default_builder.length_rule(2))
                self.assertEqual(default_builder.WPM, 140)

    def test_explicit_duration_override_is_still_honored(self):
        override_builder = load_builder("30")
        self.assertEqual(override_builder.TOTAL_MINUTES, 30)
        self.assertIn("capped at 30 minutes", override_builder.length_rule(2))

    def test_short_script_gets_one_grounded_edit_and_retains_metadata(self):
        with patch.object(builder, "claude", return_value="SCRIPT:\n" + script(260)) as api:
            result = builder.enforce_length(self.data, 2, "sports", source_material="Verified fixture detail",
                                            scope="Sports only. Other story belongs to markets.")
        api.assert_called_once()
        prompt = api.call_args.args[0]
        self.assertIn("Verified fixture detail", prompt)
        self.assertIn("Other story belongs to markets", prompt)
        self.assertIn("original script unchanged", prompt)
        self.assertIn("Do not introduce new stories", prompt)
        self.assertEqual(api.call_args.kwargs["web_searches"], 0)
        self.assertLessEqual(api.call_args.args[1], 12000)
        self.assertEqual(result["script"], script(260) + self.tail)
        self.assertEqual({k: v for k, v in result.items() if k != "script"},
                         {k: v for k, v in self.data.items() if k != "script"})
        self.assertEqual(self.data["script"], script(150) + self.tail)

    def test_in_range_and_exact_boundaries_make_no_call(self):
        for words in (238, 260, 280, 322):  # 85% and 115% of a 280-word target
            with self.subTest(words=words), patch.object(builder, "claude") as api:
                data = {**self.data, "script": script(words) + self.tail}
                self.assertIs(builder.enforce_length(data, 2, source_material="Fixture"), data)
                api.assert_not_called()

    def test_dry_run_and_missing_material_make_no_call(self):
        with patch.object(builder, "claude") as api:
            self.assertIs(builder.enforce_length(self.data, 2), self.data)
            with patch.object(builder, "DRY_RUN", True):
                self.assertIs(builder.enforce_length(self.data, 2, source_material="Fixture"), self.data)
            api.assert_not_called()

    def test_one_word_below_floor_is_repaired_without_counting_talking_points(self):
        data = {**self.data, "script": script(237) + "\n\nTalking points\n- " + script(300)}
        with patch.object(builder, "claude", return_value="SCRIPT:\n" + script(255)) as api:
            result = builder.enforce_length(data, 2, source_material="Fixture")
        api.assert_called_once()
        self.assertEqual(len(builder.split_talking_points(result["script"])[0].split()), 255)

    def test_thin_invalid_or_failed_expansion_keeps_original_without_retry(self):
        for response in ("SCRIPT:\n" + script(150), "SCRIPT:\n" + script(100),
                         "SCRIPT:\n" + script(281), "malformed response", RuntimeError("API unavailable")):
            with self.subTest(response=str(response)[:35]):
                kwargs = {"side_effect": response} if isinstance(response, Exception) else {"return_value": response}
                with patch.object(builder, "claude", **kwargs) as api:
                    self.assertIs(builder.enforce_length(self.data, 2, source_material="Fixture"), self.data)
                api.assert_called_once()

    def test_useful_partial_expansion_does_not_start_another_attempt(self):
        with patch.object(builder, "claude", return_value="SCRIPT:\n" + script(200)) as api:
            result = builder.enforce_length(self.data, 2, source_material="Thin fixture")
        self.assertEqual(result["script"], script(200) + self.tail)
        api.assert_called_once()

    def test_overlong_script_still_gets_one_tightening_pass(self):
        data = {**self.data, "script": script(323) + self.tail}
        with patch.object(builder, "claude", return_value="SCRIPT:\n" + script(280)) as api:
            result = builder.enforce_length(data, 2, "sports")
        self.assertEqual(result["script"], script(280) + self.tail)
        api.assert_called_once()
        self.assertEqual(api.call_args.kwargs["label"], "tighten sports")
        self.assertEqual(api.call_args.kwargs["web_searches"], 0)

    def test_failed_or_still_overlong_tightening_keeps_original(self):
        data = {**self.data, "script": script(400)}
        for response in ("SCRIPT:\n" + script(350), RuntimeError("API unavailable")):
            kwargs = {"side_effect": response} if isinstance(response, Exception) else {"return_value": response}
            with patch.object(builder, "claude", **kwargs) as api:
                self.assertIs(builder.enforce_length(data, 2), data)
            api.assert_called_once()

    def test_news_repair_reuses_capped_sources_and_ownership_without_more_searches(self):
        spec = {"label": "Sports", "brief": "Sports coverage", "prefer_web": []}
        items = [{"outlet": "Fixture", "title": name, "summary": "Supplied facts", "url": "https://example.com/a"}
                 for name in ("Included headline", "Excluded headline")]
        plan = {"owns": [{"event": "Sports coverage"}], "callbacks": [],
                "elsewhere": [{"line": "Market news belongs elsewhere"}]}
        responses = ["TITLE: Fixture\nSCRIPT:\n" + script(150), "SCRIPT:\n" + script(260)]
        with patch.object(builder, "claude", side_effect=responses) as api, \
                patch.object(builder, "FEED_ITEMS", 1), patch.object(builder, "NEWSLETTERS", {}):
            builder.write_script("sports", spec, items, 2, plan)
        self.assertEqual(api.call_count, 2)
        self.assertEqual(api.call_args_list[0].kwargs["web_searches"], builder.SEARCHES_PER_BLOCK)
        self.assertEqual(api.call_args_list[1].kwargs["web_searches"], 0)
        repair_prompt = api.call_args_list[1].args[0]
        self.assertIn("Included headline", repair_prompt)
        self.assertNotIn("Excluded headline", repair_prompt)
        self.assertIn("Market news belongs elsewhere", repair_prompt)

    def test_lesson_uses_same_edit_and_preserves_task_and_drill(self):
        responses = ["TITLE: A concept\nSCRIPT:\n" + script(150) + "\nTASK:\nPractice it\nDRILL:\nScore it",
                     "SCRIPT:\n" + script(260)]
        with patch.object(builder, "claude", side_effect=responses) as api:
            data = builder.write_lesson("test", {"label": "Test", "framing": "Explain carefully"},
                                        None, 0, ["A concept"], 280)
        self.assertEqual(api.call_count, 2)
        self.assertEqual(data["task"], "Practice it")
        self.assertEqual(data["drill"], "Score it")
        self.assertEqual(data["title"], "A concept")
        self.assertEqual(data["script"], script(260))
        self.assertIn("hypothetical", api.call_args.args[0])
        self.assertEqual(api.call_args.kwargs["web_searches"], 0)

    def test_production_allows_more_than_thirty_minutes_and_rejects_over_sixty(self):
        for seconds in (2400, 3600, 3600.01):
            with self.subTest(seconds=seconds), tempfile.TemporaryDirectory() as directory:
                self.check_production_duration(Path(directory), seconds)

    def check_production_duration(self, root, seconds):
        manifest = root / "manifest.json"
        original = '{"days": []}'
        manifest.write_text(original)
        (root / "sources.json").write_text(json.dumps({"sports": {"label": "Sports", "feeds": []}}))
        block = {"id": "sports", "minutes": round(seconds / 60, 1), "durationSeconds": seconds}
        with patch.object(runner, "_configure_shared_patches"), patch.object(runner, "retire"), \
                patch.object(builder, "HERE", root), patch.object(builder, "MANIFEST", manifest), \
                patch.object(builder, "OUT", root / "out"), patch.object(builder, "WEEKDAY", "sat"), \
                patch.object(runner, "newsletters_with_health", return_value={}), \
                patch.object(runner, "fresh_items", return_value=[]), \
                patch.object(runner, "resilient_plan", return_value=({}, "fixture", [])), \
                patch.object(runner, "adaptive_minutes", return_value=({"sports": 60}, [], {})) as allocation, \
                patch.object(builder, "write_script", return_value=self.data), \
                patch.object(runner, "measured_block", return_value=block), \
                patch.object(runner, "write_health", return_value={}) as health:
            if seconds > 3600:
                with self.assertRaisesRegex(ValueError, "exceeds the 60 min cap"):
                    runner.normal_main()
                self.assertEqual(manifest.read_text(), original)
                self.assertFalse(manifest.with_name("feed.xml").exists())
                health.assert_not_called()
            else:
                runner.normal_main()
                day = json.loads(manifest.read_text())["days"][0]
                self.assertEqual(day["budgetMinutes"], 60)
                self.assertEqual(day["durationSeconds"], seconds)
                self.assertTrue(manifest.with_name("feed.xml").exists())
            self.assertEqual(allocation.call_args.kwargs["total_minutes"], 60)


if __name__ == "__main__":
    unittest.main()
