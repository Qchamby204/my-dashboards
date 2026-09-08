import copy
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("publication", Path(__file__).resolve().parents[1] / "publication.py")
publication = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publication)


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.repo = "example/courier"
        self.day = {"date": "2026-09-08", "generatedAt": "2026-09-08T12:00:00Z", "blocks": [{"id": "news", "script": "Synthetic test section.", "audio": "https://cdn.jsdelivr.net/gh/example/courier@courier-audio/2026-09-08/news.mp3"}]}
        self.manifest = {"days": [self.day]}

    def test_accepted_build_waits_for_exact_public_edition(self):
        calls, waits, probes = [], [], []
        stale = copy.deepcopy(self.manifest)
        stale["days"][0]["generatedAt"] = "2026-09-08T10:00:00Z"
        responses = iter([{"status": "queued"}, stale, self.manifest])
        def request(url, **kwargs):
            calls.append((url, kwargs))
            return next(responses)
        item = publication.publish(self.manifest, self.day["date"], self.repo, "synthetic-token", request=request, probe=lambda *args: probes.append(args), pause=waits.append, attempts=2)
        self.assertEqual(item, self.day)
        self.assertEqual(waits, [10])
        self.assertEqual(len(probes), 1)
        self.assertEqual(calls[0][1], {"token": "synthetic-token", "method": "POST"})
        self.assertTrue(all(not args for _, args in calls[1:]))

    def test_unavailable_audio_cannot_report_success(self):
        def request(url, **kwargs):
            return self.manifest
        def probe(*args):
            raise OSError("CDN not ready")
        with self.assertRaisesRegex(RuntimeError, "could not be verified"):
            publication.publish(self.manifest, self.day["date"], self.repo, "synthetic-token", request=request, probe=probe, pause=lambda _: None, attempts=2)

    def test_partial_edition_is_preserved_and_not_treated_as_full_audio(self):
        self.day["blocks"][0]["audio"] = ""
        item = publication.publish(self.manifest, self.day["date"], self.repo, "synthetic-token", request=lambda *a, **k: self.manifest, probe=lambda *a: self.fail("Text-only block was probed"), attempts=1)
        self.assertEqual(item["blocks"][0]["audio"], "")

    def test_empty_or_duplicate_sections_fail_before_publication(self):
        self.day["blocks"].append(copy.deepcopy(self.day["blocks"][0]))
        with self.assertRaises(ValueError):
            publication.edition(self.manifest, self.day["date"])
        self.day["blocks"] = []
        with self.assertRaises(ValueError):
            publication.edition(self.manifest, self.day["date"])

    def test_pin_audio_changes_only_current_edition_urls(self):
        prior = copy.deepcopy(self.day)
        prior["date"] = "2026-09-07"
        self.manifest["days"].append(prior)
        original = self.day["blocks"][0]["audio"]
        replacements = publication.pin_audio(self.manifest, self.day["date"], self.repo, "a" * 40)
        self.assertEqual(replacements[original], original.replace("@courier-audio/", "@" + "a" * 40 + "/"))
        self.assertEqual(prior["blocks"][0]["audio"], original)

    def test_audio_origin_and_token_origin_are_restricted(self):
        with self.assertRaises(ValueError):
            publication.probe_audio("https://example.com/audio.mp3", self.repo)
        with self.assertRaises(ValueError):
            publication.request_json("https://example.com/", token="synthetic-token")


if __name__ == "__main__":
    unittest.main()
