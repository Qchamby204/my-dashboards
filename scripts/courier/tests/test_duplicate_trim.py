"""Synthetic partial-overlap regression; no model, feed or voice calls."""
import copy
import importlib.util
import json
import sys
import tempfile
import types
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from coverage import overlap_report, trim_duplicate_draft

with patch.dict(sys.modules, {name: types.ModuleType(name) for name in ("requests", "feedparser")}):
    spec = importlib.util.spec_from_file_location("courier_trim_builder_test", HERE / "build.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
with patch.dict(sys.modules, {"build": builder}):
    spec = importlib.util.spec_from_file_location("courier_trim_run_test", HERE / "run.py")
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)


def fixture():
    repeated = [
        "Manitoba Hydro releases its annual report with a drought-driven loss.",
        "United Way Winnipeg opens its grant intake for nonprofits.",
        "Saskatchewan plans two large nuclear reactors.",
    ]
    fresh = [
        "Peatland restoration trial measures a reduction in methane emissions.",
        "Coastal sensor network detects saltwater intrusion in drinking wells.",
    ]
    sources = [{"outlet": "Fixture News", "title": repeated[0], "url": "https://example.com/hydro"}]
    sources += [{"outlet": "Science Fixture", "title": title, "url": f"https://example.com/fresh/{i}"}
                for i, title in enumerate(fresh)]
    # Ten cited items, but only the two fresh stories below are worth retaining.
    sources += [{"outlet": "Unused Fixture", "title": f"Unused reference {i}", "url": f"https://example.com/unused/{i}"}
                for i in range(7)]
    paragraphs = ["Fixture News reports: " + p for p in repeated]
    paragraphs += ["Science Fixture reports: " + fresh[0] + " Researchers measured the trial plots against untreated controls.",
                   "Science Fixture reports: " + fresh[1] + " The measurements give operators earlier warning of contamination."]
    body = "\n\n".join(paragraphs)
    points = repeated + fresh
    draft = {"slug": "climate", "spec": {"label": "Climate"}, "body": body, "points": points,
             "data": {"title": "Hydro and climate developments", "sources": sources,
                      "script": body + "\n\nTalking points\n" + "\n".join("- " + p for p in points)}}
    accepted = [{"data": {"title": "Regional briefing", "sources": [sources[0]]}, "points": repeated}]
    selection = {"keep": [{"paragraph": 3, "sources": [1], "points": [3]},
                          {"paragraph": 4, "sources": [2], "points": [4]}]}
    return draft, accepted, selection


class DuplicateTrimTests(unittest.TestCase):
    def setUp(self):
        self.draft, self.accepted, self.selection = fixture()
        self.courier = types.SimpleNamespace(claude=Mock(return_value=json.dumps(self.selection)))

    def trim(self):
        return trim_duplicate_draft(self.courier, self.draft, self.accepted, {})

    def test_partial_climate_overlap_keeps_original_fresh_passages_and_citations(self):
        original = copy.deepcopy(self.draft)
        report = overlap_report(self.draft["data"], self.draft["points"], self.accepted)
        self.assertEqual((report["material"], report["sourceRatio"], report["pointRatio"]), (True, 0.1, 0.6))
        result = self.trim()
        body, points = builder.split_talking_points(result["script"])
        self.assertEqual(body, "\n\n".join(self.draft["body"].split("\n\n")[3:]))
        self.assertEqual(points, self.draft["points"][3:])
        self.assertEqual(result["sources"], self.draft["data"]["sources"][1:3])
        self.assertEqual(result["title"], result["sources"][0]["title"])
        self.assertFalse(overlap_report(result, points, self.accepted)["material"])
        self.assertEqual(self.draft, original)
        self.courier.claude.assert_called_once()
        self.assertEqual(self.courier.claude.call_args.kwargs["web_searches"], 0)
        self.assertEqual(self.courier.claude.call_args.args[1], 2000)

    def test_editor_cannot_hide_repeated_body_behind_a_fresh_citation(self):
        self.selection["keep"] += [{"paragraph": 0, "sources": [1], "points": [0]},
                                   {"paragraph": 1, "sources": [2], "points": [1]}]
        # Repeated points are rejected even when attached to a genuinely fresh paragraph.
        self.selection["keep"][0]["points"] += [0, 1, 2]
        self.courier.claude.return_value = json.dumps(self.selection)
        result = self.trim()
        for repeated in self.draft["points"][:3]:
            self.assertNotIn(repeated, result["script"])
        self.assertIn(self.draft["points"][3], result["script"])

    def test_mixed_paragraph_and_duplicate_citation_are_dropped_whole(self):
        self.draft["body"] += " " + self.draft["points"][0]
        self.selection["keep"][0]["sources"] = [0, 1]
        self.courier.claude.return_value = json.dumps(self.selection)
        self.assertEqual(self.trim()["script"], "")

    def test_entirely_repeated_draft_skips_without_edit_call(self):
        self.draft["body"] = self.draft["body"].split("\n\n")[0]
        self.draft["data"]["sources"] = self.draft["data"]["sources"][:1]
        self.assertEqual(self.trim()["script"], "")
        self.courier.claude.assert_not_called()

    def test_invalid_indices_and_malformed_output_fail_closed_without_retry(self):
        for output in ["not JSON", "[]", '{"keep":[null]}',
                       '{"keep":[{"paragraph":99,"sources":[1]}]}',
                       '{"keep":[{"paragraph":true,"sources":[1]}]}',
                       '{"keep":[{"paragraph":3,"sources":[-1]}]}',
                       json.dumps({"keep": [self.selection["keep"][0]] * 2})]:
            with self.subTest(output=output):
                self.courier.claude.reset_mock()
                self.courier.claude.return_value = output
                with self.assertRaises(ValueError):
                    self.trim()
                self.courier.claude.assert_called_once()


class DuplicatePublicationTests(unittest.TestCase):
    def generate(self, edit_error=None):
        draft, accepted, selection = fixture()
        with tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
            root = Path(directory)
            sources = {s: {"label": s.title(), "feeds": []} for s in ("markets", "climate", "tech", "parenting")}
            (root / "sources.json").write_text(json.dumps(sources))
            manifest_path = root / "courier" / "manifest.json"
            manifest_path.parent.mkdir()
            manifest_path.write_text('{"days":[]}')
            plan = {s: {"owns": [], "callbacks": [], "elsewhere": [], "context": []} for s in sources}
            market_data = {**accepted[0]["data"], "script": "\n\n".join(accepted[0]["points"])
                           + "\n\nTalking points\n" + "\n".join("- " + p for p in accepted[0]["points"])}
            scripts = {"markets": market_data, "climate": draft["data"],
                       "tech": {"title": "Database release", "script": "A new database supports encrypted backups.", "sources": []}}
            def voice(slug, label, title, body, points, citations, *args):
                return {"id": slug, "label": label, "title": title, "script": body, "talkingPoints": points,
                        "sources": citations, "audio": f"{slug}.mp3", "minutes": 1, "durationSeconds": 60}
            for name, value in {"HERE": root, "MANIFEST": manifest_path, "OUT": root / "out",
                                "TODAY": "2026-09-30", "WEEKDAY": "wed", "VOICELESS": []}.items():
                stack.enter_context(patch.object(builder, name, value))
            stack.enter_context(patch.object(runner, "_configure_shared_patches"))
            stack.enter_context(patch.object(runner, "newsletters_with_health", return_value={}))
            stack.enter_context(patch.object(runner, "fresh_items", return_value=[]))
            stack.enter_context(patch.object(runner, "resilient_plan", return_value=(plan, "fixture", [])))
            stack.enter_context(patch.object(runner, "adaptive_minutes", return_value=(
                {"markets": 3, "climate": 5.5, "tech": 5, "parenting": 0}, ["parenting"], {"climate": 25})))
            writing = stack.enter_context(patch.object(builder, "write_script", side_effect=lambda slug, *a: copy.deepcopy(scripts[slug])))
            editing = stack.enter_context(patch.object(builder, "claude", return_value=json.dumps(selection), side_effect=edit_error))
            stack.enter_context(patch.object(builder, "write_lessons", return_value=[]))
            stack.enter_context(patch.object(builder, "log"))
            stack.enter_context(patch.object(runner, "measured_block", side_effect=voice))
            stack.enter_context(patch.object(runner, "measured_feed"))
            runner.normal_main()
            day = json.loads(manifest_path.read_text())["days"][0]
            self.assertEqual(writing.call_count, 3)  # Never rewrite from newsletters or search.
            editing.assert_called_once()
            self.assertEqual(editing.call_args.kwargs["web_searches"], 0)
            return day

    def test_trimmed_climate_stays_expected_and_published_even_if_plan_missed_newsletter_story(self):
        day = self.generate()
        self.assertEqual([b["id"] for b in day["blocks"]], ["markets", "climate", "tech"])
        self.assertIn("climate", day["expectedSections"])
        self.assertNotIn("climate", day["missingSections"])
        self.assertEqual(day["allocationMinutes"]["climate"], 5.5)
        self.assertEqual(day["duplicateRejectedSections"], [])
        self.assertEqual(day["skippedSections"], ["parenting"])  # Thin-news skip unchanged.
        self.assertEqual(day["duplicateRepairs"][0]["method"], "trim-existing-draft")
        self.assertFalse(day["duplicateRepairs"][0]["secondPass"]["material"])

    def test_failed_edit_is_isolated_and_never_publishes_the_duplicate_draft(self):
        day = self.generate(edit_error=RuntimeError("Synthetic editor failure"))
        self.assertEqual([b["id"] for b in day["blocks"]], ["markets", "tech"])
        self.assertEqual(day["duplicateRejectedSections"], ["climate"])
        self.assertEqual(day["allocationMinutes"]["climate"], 0)


if __name__ == "__main__":
    unittest.main()
