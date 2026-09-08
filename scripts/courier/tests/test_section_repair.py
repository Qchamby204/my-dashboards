import copy
import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# These tests never make HTTP/feed requests. Stub optional imports so the actual
# generator functions can be exercised in a standard-library-only environment.
with patch.dict(sys.modules, {name: types.ModuleType(name) for name in ("requests", "feedparser")}):
    spec = importlib.util.spec_from_file_location("courier_builder_test", Path(__file__).resolve().parents[1] / "build.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)


class SectionRepairTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.manifest_path, self.out = root / "manifest.json", root / "out"
        self.block = {"id": "frontpage", "label": "Front page", "title": "Fictional edition", "script": "An existing fictional section.", "audio": "https://cdn.jsdelivr.net/gh/example/courier@" + "b" * 40 + "/2026-09-08/frontpage.mp3", "bytes": 64, "words": 4, "minutes": 1, "talkingPoints": [], "sources": []}
        self.manifest = {"days": [{"date": "2026-09-08", "generatedAt": "2026-09-08T12:00:00Z", "release": "courier-2026-09-08", "blocks": [self.block]}]}
        self.manifest_path.write_text(json.dumps(self.manifest))
        for name, value in [("MANIFEST", self.manifest_path), ("OUT", self.out), ("TODAY", "2026-09-08"), ("REPO", "example/courier")]:
            p = patch.object(builder, name, value)
            p.start()
            self.addCleanup(p.stop)

    def sports(self, *args):
        return {**self.block, "id": "sports", "label": "Sports", "title": "Fictional sports", "script": "Fictional sports update.", "audio": "https://cdn.jsdelivr.net/gh/example/courier@courier-audio/2026-09-08/sports.mp3", "bytes": 80}

    def test_adding_sports_preserves_every_existing_block_and_lesson_progress(self):
        with patch.object(builder, "fetch_newsletters", return_value={}), patch.object(builder, "fetch_items", return_value=[]), patch.object(builder, "write_script", return_value={"title": "Fictional sports", "script": "Fictional sports update."}), patch.object(builder, "make_block", side_effect=self.sports), patch.object(builder, "write_lessons") as lessons:
            builder.repair_sports()
        result = json.loads(self.manifest_path.read_text())
        self.assertEqual(result["days"][0]["blocks"][0], self.block)
        self.assertEqual([b["id"] for b in result["days"][0]["blocks"]], ["frontpage", "sports"])
        self.assertNotIn("sports", result["days"][0]["missingSections"])
        self.assertIn(self.block["audio"], self.manifest_path.with_name("feed.xml").read_text())
        self.assertEqual((self.out / "keep-days.txt").read_text(), "2026-09-08")
        lessons.assert_not_called()

    def test_failed_repair_does_not_write_the_existing_manifest(self):
        original = self.manifest_path.read_bytes()
        with patch.object(builder, "fetch_newsletters", return_value={}), patch.object(builder, "fetch_items", return_value=[]), patch.object(builder, "write_script", side_effect=ValueError("No script")):
            with self.assertRaises(ValueError):
                builder.repair_sports()
        self.assertEqual(self.manifest_path.read_bytes(), original)

    def test_audio_retry_uses_saved_sports_script_without_research(self):
        old = {**self.sports(), "audio": "", "bytes": 0}
        self.manifest["days"][0]["blocks"].append(old)
        self.manifest_path.write_text(json.dumps(self.manifest))
        with patch.object(builder, "fetch_newsletters") as newsletters, patch.object(builder, "write_script") as writing, patch.object(builder, "make_block", side_effect=self.sports) as voice:
            builder.repair_sports()
        newsletters.assert_not_called()
        writing.assert_not_called()
        self.assertEqual(voice.call_args.args[3], old["script"])
        result = json.loads(self.manifest_path.read_text())["days"][0]["blocks"][-1]
        self.assertEqual({k: v for k, v in result.items() if k not in {"audio", "bytes"}}, {k: v for k, v in old.items() if k not in {"audio", "bytes"}})

    def test_multiple_repairs_keep_a_success_when_another_section_fails(self):
        def write(slug, *args):
            if slug == "sports":
                raise ValueError("Temporary writer error")
            return {"title": "Fictional market news", "script": "Fictional market update."}
        def voice(slug, *args):
            return {**self.sports(), "id": slug}
        with patch.object(builder, "fetch_newsletters", return_value={}), patch.object(builder, "fetch_items", return_value=[]), patch.object(builder, "write_script", side_effect=write), patch.object(builder, "make_block", side_effect=voice):
            builder.repair_sections(["markets", "sports"])
        day = json.loads(self.manifest_path.read_text())["days"][0]
        self.assertEqual(day["blocks"][0], self.block)
        self.assertIn("markets", [b["id"] for b in day["blocks"]])
        self.assertIn("sports", day["missingSections"])
        self.assertIn("sports", day["failed"])

    def test_lesson_repair_does_not_change_curriculum_progress(self):
        progress = Path(self.temp.name) / "progress.json"
        original = '{"lastAdvanced":"2026-09-08","technical":4}'
        progress.write_text(original)
        with patch.object(builder, "PROGRESS", progress), patch.object(builder, "WEEKDAY", "tue"), patch.object(builder, "write_lesson", return_value={"title":"Fictional lesson", "script":"Synthetic learning", "task":"Review"}):
            builder.write_lessons(8, repair=True)
        self.assertEqual(progress.read_text(), original)

    def test_empty_search_response_gets_one_writing_retry_without_web_tools(self):
        response = "TITLE: Fictional sports\nSCRIPT:\n" + "A fictional update from the supplied source. " * 15 + "\nSOURCES:\nExample | Fixture | https://example.com/fixture"
        spec = {"label": "Sports", "brief": "Fictional sports", "prefer_web": []}
        with patch.object(builder, "claude", side_effect=["", response]) as api, patch.object(builder, "enforce_length", side_effect=lambda data, *a, **k: data), patch.object(builder, "DRY_RUN", False), patch.object(builder, "NEWSLETTERS", {}):
            result = builder.write_script("sports", spec, [], 4)
        self.assertEqual(api.call_count, 2)
        self.assertEqual(api.call_args_list[1].kwargs["web_searches"], 0)
        self.assertNotIn("Preferred outlets when you do search", api.call_args_list[1].args[0])
        self.assertIn("No tools are available", api.call_args_list[1].args[0])
        self.assertEqual(result["title"], "Fictional sports")


if __name__ == "__main__":
    unittest.main()
