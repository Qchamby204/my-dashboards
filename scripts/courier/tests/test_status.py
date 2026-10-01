import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publication
import status


class StatusTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.path = self.root / "status.json"
        self.day = {"date": "2026-09-30", "generatedAt": "2026-09-30T10:47:34Z",
                    "expectedSections": ["markets", "sports"], "blocks": [
                        {"id": slug, "script": "Synthetic test script", "audio": f"{slug}.mp3"}
                        for slug in ("markets", "sports")]}
        self.previous = status.snapshot("verified", self.day, self.day["date"], now="2026-09-30T10:49:00Z")
        self.now = "2026-09-30T16:26:00Z"
        snapshot = status.snapshot
        patches = [patch.object(status, "PATH", self.path), patch.object(status, "ROOT", self.root),
                   patch.dict(os.environ, {"REPO": "example/courier", "GH_TOKEN": "synthetic-token"}),
                   patch.object(status, "snapshot", side_effect=lambda state, item, date:
                                snapshot(state, item, date, now=self.now))]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.git = self.start_patch(patch.object(status.subprocess, "run"))
        self.http = self.start_patch(patch.object(status, "request_json", side_effect=self.live))
        self.pause = self.start_patch(patch.object(status.time, "sleep"))
        self.seed()

    def start_patch(self, p):
        result = p.start()
        self.addCleanup(p.stop)
        return result

    def seed(self, record=None):
        self.path.write_text(json.dumps({"schemaVersion": 1, "days": [
            record if record is not None else self.previous,
            {"date": "2026-09-29", "state": "failed"}]}))

    def live(self, url, **kwargs):
        if kwargs.get("method") == "POST":
            return {"status": "queued"}
        return json.loads(self.path.read_text())

    def publish(self, state="verified"):
        return status.publish_status(state, self.day, self.day["date"])

    def builds(self):
        return [c for c in self.http.call_args_list if c.kwargs.get("method") == "POST"]

    def assert_pushed(self):
        commands = [c.args[0][1] for c in self.git.call_args_list]
        self.assertEqual(commands, ["config", "config", "add", "commit", "pull", "push"])
        self.assertEqual(len(self.builds()), 1)

    def test_complete_timestamp_only_verification_leaves_file_and_history_untouched(self):
        original = self.path.read_bytes()
        for now in ["2026-09-30T16:26:00Z", "2026-09-30T17:00:00Z"]:
            self.now = now
            self.assertEqual(self.publish(), self.previous)
        self.assertEqual(self.path.read_bytes(), original)
        self.git.assert_not_called()
        self.assertEqual(self.builds(), [])
        self.assertEqual(self.http.call_count, 2)
        self.assertTrue(all("?check=" in c.args[0] and not c.kwargs for c in self.http.call_args_list))

    def test_unchanged_record_recovers_stale_public_status_without_a_commit(self):
        original = self.path.read_bytes()
        self.http.side_effect = [{"days": []}, {"status": "queued"}, json.loads(original)]
        self.assertEqual(self.publish(), self.previous)
        self.assertEqual(self.path.read_bytes(), original)
        self.git.assert_not_called()
        self.assertEqual(len(self.builds()), 1)
        self.pause.assert_called_once_with(10)

    def test_unavailable_public_status_fails_after_bounded_recovery_without_a_commit(self):
        original = self.path.read_bytes()
        def unavailable(url, **kwargs):
            if kwargs.get("method") == "POST":
                return {"status": "queued"}
            raise OSError("Pages unavailable")
        self.http.side_effect = unavailable
        with self.assertRaisesRegex(RuntimeError, "public status has not caught up"):
            self.publish()
        self.git.assert_not_called()
        self.assertEqual(self.path.read_bytes(), original)
        self.assertEqual(len(self.builds()), 1)
        self.assertEqual(self.http.call_count, 37)
        self.assertEqual(self.pause.call_count, 35)

    def test_first_verification_writes_status_and_verifies_public_delivery(self):
        self.path.unlink()
        record = self.publish()
        self.assertEqual(record["state"], "complete")
        self.assertEqual(record["verifiedAt"], self.now)
        self.assertEqual(json.loads(self.path.read_text())["days"], [record])
        self.assert_pushed()
        self.assertEqual(self.http.call_count, 2)

    def test_meaningful_changes_and_missing_proof_are_published(self):
        for change in [{"generatedAt": "older"}, {"updatedAt": "older"},
                       {"audio": {"markets": "old.mp3", "sports": "sports.mp3"}},
                       {"expectedSections": ["markets"]}, {"missingSections": ["sports"]},
                       {"voiceless": ["sports"]}, {"verifiedAt": None}, {"checkedAt": None},
                       {"state": "partial"}, {"state": "failed"}, {"state": "updating"}]:
            with self.subTest(change=change):
                self.seed({**self.previous, **change})
                self.git.reset_mock()
                self.http.reset_mock()
                record = self.publish()
                self.assertEqual(record, {**self.previous, "checkedAt": self.now, "verifiedAt": self.now})
                self.assert_pushed()
                self.assertEqual(json.loads(self.path.read_text())["days"][1]["date"], "2026-09-29")

    def test_new_date_is_published_and_preserves_prior_proof(self):
        self.day["date"] = "2026-10-01"
        self.day["generatedAt"] = "2026-10-01T10:47:34Z"
        self.publish()
        self.assert_pushed()
        self.assertEqual(json.loads(self.path.read_text())["days"][1], self.previous)

    def test_updating_failed_and_partial_results_still_publish(self):
        for state in ("updating", "failed", "verified"):
            with self.subTest(state=state):
                self.seed()
                self.git.reset_mock()
                self.http.reset_mock()
                if state == "verified":
                    self.day["blocks"][1]["audio"] = ""
                record = self.publish(state)
                self.assertEqual(record["state"], "partial" if state == "verified" else state)
                self.assertEqual(record["verifiedAt"], self.now if state == "verified" else None)
                self.assert_pushed()

    def test_cli_reverifies_live_edition_and_audio_and_reports_without_writes(self):
        manifest_path = self.root / "manifest.json"
        manifest = {"days": [self.day]}
        manifest_path.write_text(json.dumps(manifest))
        summary = self.root / "summary.txt"
        request, probe = Mock(return_value=manifest), Mock()
        publish = publication.publish
        original = self.path.read_bytes()
        with patch.object(publication, "MANIFEST", manifest_path), \
                patch.object(sys, "argv", ["publication.py", "publish", "--date", self.day["date"]]), \
                patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(summary)}), \
                patch.object(publication, "publish", side_effect=lambda *a: publish(
                    *a, request=request, probe=probe, pause=self.pause, attempts=2)):
            publication.main()
            self.assertEqual(probe.call_count, 2)
            request.assert_called_once()
            self.assertEqual(request.call_args.kwargs, {})
            self.assertIn("live edition verified; 2 audio sections, 0 text-only sections; COMPLETE", summary.read_text())
            self.assertEqual(self.path.read_bytes(), original)
            self.git.assert_not_called()
            self.assertEqual(self.builds(), [])
            # Existing Complete proof must not let a later audio failure succeed.
            self.http.reset_mock()
            probe.side_effect = OSError("CDN unavailable")
            with self.assertRaisesRegex(RuntimeError, "could not be verified"):
                publication.main()
            self.http.assert_not_called()
            self.assertEqual(len(summary.read_text().splitlines()), 1)


if __name__ == "__main__":
    unittest.main()
