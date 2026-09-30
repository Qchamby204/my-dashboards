import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import automatic
import recovery
from completeness import expected_sections


class AutomaticTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.fromisoformat("2026-09-29T10:17:00+00:00")
        self.trigger = {"schemaVersion": 1, "date": "2026-09-29",
                        "requestedAt": self.now.isoformat(), "attempt": 1}
        self.state = {"schemaVersion": 1, "days": []}
        self.day = {"date": "2026-09-29", "generatedAt": self.now.isoformat(),
                    "blocks": [{"id": slug, "script": "Saved script", "audio": f"{slug}.mp3"}
                               for slug in expected_sections("2026-09-29")]}

    def plan(self, days, **kwargs):
        return recovery.choose_plan({"days": days}, "push", now=self.now,
                                    daily_trigger=self.trigger, automatic_state=self.state, **kwargs)

    def test_independent_tick_builds_missing_edition_without_manual_request(self):
        plan = self.plan([])
        self.assertTrue(plan["generate"] and plan["publish"] and plan["automatic"])
        self.assertEqual(plan["sections"], "")

    def test_queued_duplicate_and_delayed_schedule_reuse_completed_audio(self):
        original = copy.deepcopy(self.day)
        for plan in [self.plan([self.day]), recovery.choose_plan(
                {"days": [self.day]}, "schedule", now=self.now, automatic_state=self.state)]:
            self.assertFalse(plan["generate"])
            self.assertTrue(plan["publish"])
            self.assertEqual(plan["sections"], "")
        self.assertEqual(self.day, original)
        self.assertNotIn("frontpage", expected_sections(self.day["date"]))

    def test_partial_edition_repairs_only_missing_or_voiceless_sections(self):
        self.day["blocks"] = [b for b in self.day["blocks"] if b["id"] != "markets"]
        next(b for b in self.day["blocks"] if b["id"] == "sports")["audio"] = ""
        original = copy.deepcopy(self.day)
        self.assertEqual(set(self.plan([self.day])["sections"].split(",")), {"markets", "sports"})
        self.assertEqual(self.day, original)

    def test_shared_cap_covers_failed_generation_ticks_and_late_crons(self):
        for count in range(1, 4):
            self.assertTrue(self.plan([])["generate"])
            self.state = automatic.reserve(self.state, self.trigger["date"])
            self.assertEqual(automatic.attempts(self.state, self.trigger["date"]), count)
        for event, kwargs in [("push", {"daily_trigger": self.trigger}), ("schedule", {})]:
            plan = recovery.choose_plan({"days": []}, event, now=self.now,
                                        automatic_state=self.state, **kwargs)
            self.assertFalse(plan["generate"] or plan["publish"])
            partial = copy.deepcopy(self.day)
            partial["blocks"][0]["audio"] = ""
            plan = recovery.choose_plan({"days": [partial]}, event, now=self.now,
                                        automatic_state=self.state, **kwargs)
            self.assertFalse(plan["generate"])
            self.assertTrue(plan["publish"])
        with self.assertRaises(ValueError):
            automatic.reserve(self.state, self.trigger["date"])
        self.assertTrue(recovery.choose_plan({"days": []}, "push", now=self.now,
                                            request=self.trigger)["generate"])
        self.assertTrue(recovery.choose_plan({"days": [self.day]}, "workflow_dispatch",
                                            now=self.now)["generate"])

    def test_new_day_gets_new_budget_without_resetting_history(self):
        self.state = automatic.reserve(self.state, "2026-09-28")
        self.assertEqual(automatic.attempts(self.state, "2026-09-29"), 0)
        self.assertTrue(self.plan([])["generate"])
        new = automatic.reserve(self.state, "2026-09-29")
        self.assertEqual(automatic.attempts(new, "2026-09-28"), 1)

    def test_stale_weekend_early_and_malformed_ticks_never_generate(self):
        for value in ["2026-09-29T14:00:00+00:00", "2026-09-30T10:17:00+00:00"]:
            plan = recovery.choose_plan({"days": []}, "push", now=datetime.fromisoformat(value),
                                        daily_trigger=self.trigger, automatic_state=self.state)
            self.assertFalse(plan["generate"] or plan["publish"])
        for value in ["2026-10-03T12:00:00+00:00", "2026-09-29T10:16:00+00:00"]:
            now = datetime.fromisoformat(value)
            trigger = {**self.trigger, "date": recovery.winnipeg_date(now), "requestedAt": value}
            plan = recovery.choose_plan({"days": []}, "push", now=now,
                                        daily_trigger=trigger, automatic_state=self.state)
            self.assertFalse(plan["generate"] or plan["publish"])
        for change in [{"attempt": 4}, {"attempt": True}, {"schemaVersion": True},
                       {"sections": ["sports"]}, {"requestedAt": "2026-09-29T11:00:00Z"}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                recovery.choose_plan({"days": []}, "push", now=self.now,
                                     daily_trigger={**self.trigger, **change}, automatic_state=self.state)
        with self.assertRaises(ValueError):
            self.plan([], request=self.trigger)

    def test_winnipeg_start_is_dst_aware_and_weekend_cron_is_inert(self):
        for value, expected in [("2026-01-13T11:16:00+00:00", False),
                                ("2026-01-13T11:17:00+00:00", True),
                                ("2026-09-29T10:17:00+00:00", True),
                                ("2026-10-03T13:00:00+00:00", False)]:
            plan = recovery.choose_plan({"days": []}, "schedule", now=datetime.fromisoformat(value),
                                        automatic_state=self.state)
            self.assertEqual(plan["generate"], expected)

    def test_missing_corrupt_state_and_duplicate_editions_fail_closed(self):
        for state in [None, {}, {"schemaVersion": 1, "days": [{"date": "2026-09-29", "attempts": True}]},
                      {"schemaVersion": 1, "days": [{"date": "2026-09-29", "attempts": 1}] * 2}]:
            with self.subTest(state=state), self.assertRaises(ValueError):
                recovery.choose_plan({"days": []}, "schedule", now=self.now, automatic_state=state)
        self.day["blocks"].append(copy.deepcopy(self.day["blocks"][0]))
        with self.assertRaises(ValueError):
            self.plan([self.day])

    def test_reservation_is_pushed_before_generation_and_push_failure_aborts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / automatic.STATE_PATH
            path.parent.mkdir()
            path.write_text(json.dumps(self.state))
            calls = []
            def run(args, **kwargs):
                calls.append(args)
                self.assertTrue(kwargs["check"])
                self.assertEqual(automatic.attempts(json.loads(path.read_text()), "2026-09-29"), 1)
                if args[1] == "push":
                    raise subprocess.CalledProcessError(1, args)
            with self.assertRaises(subprocess.CalledProcessError):
                automatic.claim("2026-09-29", root=root, run=run, now=self.now)
            self.assertEqual(calls[-1], ["git", "push", "origin", "HEAD:main"])
            workflow = (automatic.ROOT / ".github/workflows/courier.yml").read_text()
            self.assertLess(workflow.index("run: python scripts/courier/automatic.py"),
                            workflow.index("run: python scripts/courier/run.py"))
            self.assertIn("group: courier-publication\n  cancel-in-progress: false", workflow)
            push_paths = workflow.split("  schedule:")[0]
            self.assertIn(automatic.TRIGGER_PATH, push_paths)
            self.assertNotIn(automatic.STATE_PATH, push_paths)

    def test_push_reads_its_signal_from_event_commit_but_current_manifest_and_budget(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(recovery, "ROOT", Path(directory)):
            root = Path(directory)
            def git(*args):
                return subprocess.check_output(["git", *args], cwd=root, text=True).strip()
            git("init", "-q")
            git("config", "user.name", "Test")
            git("config", "user.email", "test@example.com")
            (root / "courier").mkdir()
            signal = root / automatic.TRIGGER_PATH
            signal.write_text(json.dumps(recovery.INERT_REQUEST))
            (root / automatic.STATE_PATH).write_text(json.dumps(self.state))
            (root / "courier/manifest.json").write_text(json.dumps({"days": []}))
            git("add", ".")
            git("commit", "-qm", "seed")
            before = git("rev-parse", "HEAD")
            signal.write_text(json.dumps(self.trigger))
            git("add", ".")
            git("commit", "-qm", "tick")
            after = git("rev-parse", "HEAD")
            # A later tick and completed edition arrived while this run waited.
            signal.write_text('{"invalid": "newer signal must not be borrowed"}')
            (root / "courier/manifest.json").write_text(json.dumps({"days": [self.day]}))
            event = root / "event.json"
            event.write_text(json.dumps({"ref": "refs/heads/main", "before": before, "after": after}))
            output = root / "output.txt"
            choose = recovery.choose_plan
            with patch.dict(os.environ, {"GITHUB_EVENT_NAME": "push", "GITHUB_EVENT_PATH": str(event),
                                          "GITHUB_OUTPUT": str(output), "PUBLISH_ONLY": ""}), \
                    patch.object(recovery, "choose_plan", side_effect=lambda *a, **k: choose(*a, **{**k, "now": self.now})):
                recovery.main()
            self.assertIn("generate=false", output.read_text())
            self.assertIn("publish=true", output.read_text())
            self.assertIn("automatic=true", output.read_text())


if __name__ == "__main__":
    unittest.main()
