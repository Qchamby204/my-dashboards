import copy
import json
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import recovery


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime.fromisoformat("2026-09-08T13:00:00+00:00")
        self.request = {"schemaVersion": 1, "date": "2026-09-08", "requestedAt": "2026-09-08T12:59:00Z", "attempt": 1}
        self.day = {"date": "2026-09-08", "generatedAt": "2026-09-08T12:00:00Z", "blocks": [{"id": "news", "script": "Fictional section", "audio": ""}]}

    def test_missing_edition_is_generated_then_published(self):
        plan = recovery.choose_plan({"days": []}, "push", now=self.now, request=self.request)
        self.assertTrue(plan["generate"])
        self.assertTrue(plan["publish"])
        self.assertEqual(plan["date"], self.request["date"])

    def test_queued_recovery_reuses_completed_edition_including_text_only(self):
        manifest = {"days": [self.day]}
        original = copy.deepcopy(manifest)
        plan = recovery.choose_plan(manifest, "push", now=self.now, request=self.request)
        self.assertFalse(plan["generate"])
        self.assertTrue(plan["publish"])
        self.assertEqual(manifest, original)

    def test_stale_weekend_and_initial_requests_do_not_run(self):
        for now in ["2026-09-09T13:00:00+00:00", "2026-09-08T17:00:00+00:00", "2026-09-12T13:00:00+00:00"]:
            request = dict(self.request)
            if "09-12" in now:
                request.update(date="2026-09-12", requestedAt=now)
            plan = recovery.choose_plan({"days": []}, "push", now=datetime.fromisoformat(now), request=request)
            self.assertFalse(plan["generate"])
            self.assertFalse(plan["publish"])
        seed = {"schemaVersion": 1, "date": None, "requestedAt": None, "attempt": 0}
        self.assertFalse(recovery.choose_plan({"days": []}, "push", now=self.now, request=seed)["publish"])

    def test_bad_requests_and_broken_editions_fail_closed(self):
        for change in [{"attempt": 4}, {"attempt": True}, {"url": "https://example.com"}, {"date": "2026-02-30"}, {"date": None}, {"requestedAt": "2026-09-08T14:00:00Z"}, {"requestedAt": "2026-09-08T12:59:00"}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                recovery.choose_plan({"days": []}, "push", now=self.now, request={**self.request, **change})
        self.day["blocks"] = []
        with self.assertRaises(ValueError):
            recovery.choose_plan({"days": [self.day]}, "push", now=self.now, request=self.request)

    def test_other_pushes_cannot_generate_and_manual_rebuild_is_preserved(self):
        manifest = {"days": [self.day]}
        for event, publish_only, generates in [("push", False, False), ("schedule", False, False), ("workflow_dispatch", True, False), ("workflow_dispatch", False, True)]:
            plan = recovery.choose_plan(manifest, event, now=self.now, publish_only=publish_only)
            self.assertEqual(plan["generate"], generates)
        self.assertTrue(recovery.choose_plan({"days": []}, "schedule", now=self.now)["generate"])

    def test_winnipeg_date_handles_winter_and_summer_midnight(self):
        self.assertEqual(recovery.winnipeg_date(datetime.fromisoformat("2026-01-13T05:30:00+00:00")), "2026-01-12")
        self.assertEqual(recovery.winnipeg_date(datetime.fromisoformat("2026-07-13T05:30:00+00:00")), "2026-07-13")
        self.assertEqual(recovery.build_date("2026-09-08", self.now), "2026-09-08")
        with self.assertRaises(ValueError):
            recovery.build_date("2026-2-3")

    def test_actual_git_diff_recognizes_only_recovery_request_changes(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(recovery, "ROOT", Path(directory)):
            def git(*args):
                return subprocess.check_output(["git", *args], cwd=directory, text=True).strip()
            git("init", "-q")
            git("config", "user.email", "test@example.com")
            git("config", "user.name", "Test")
            (Path(directory) / "courier").mkdir()
            request_file = Path(directory) / recovery.REQUEST_PATH
            request_file.write_text("{}")
            git("add", ".")
            git("commit", "-qm", "seed")
            first = git("rev-parse", "HEAD")
            (Path(directory) / "dashboard.txt").write_text("unrelated")
            git("add", ".")
            git("commit", "-qm", "dashboard")
            second = git("rev-parse", "HEAD")
            self.assertFalse(recovery.request_changed({"before": first, "after": second}))
            request_file.write_text(json.dumps(self.request))
            git("add", ".")
            git("commit", "-qm", "request")
            third = git("rev-parse", "HEAD")
            self.assertTrue(recovery.request_changed({"before": second, "after": third}))


if __name__ == "__main__":
    unittest.main()
