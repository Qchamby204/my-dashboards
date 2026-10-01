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
        responses = iter([stale, {"status": "queued"}, self.manifest])
        def request(url, **kwargs):
            calls.append((url, kwargs))
            return next(responses)
        item = publication.publish(self.manifest, self.day["date"], self.repo, "synthetic-token", request=request, probe=lambda *args: probes.append(args), pause=waits.append, attempts=2)
        self.assertEqual(item, self.day)
        self.assertEqual(waits, [10])
        self.assertEqual(len(probes), 1)
        self.assertEqual(calls[1][1], {"token": "synthetic-token", "method": "POST"})
        self.assertTrue(all(not calls[i][1] for i in (0, 2)))

    def test_live_edition_checks_every_audio_without_requesting_a_build(self):
        self.day["blocks"].append({**self.day["blocks"][0], "id": "sports",
                                   "audio": self.day["blocks"][0]["audio"].replace("news.mp3", "sports.mp3")})
        calls, probes = [], []
        def request(url, **kwargs):
            calls.append((url, kwargs))
            return self.manifest
        item = publication.publish(self.manifest, self.day["date"], self.repo, "synthetic-token",
                                   request=request, probe=lambda *args: probes.append(args), attempts=1)
        self.assertEqual(item, self.day)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][1], {})
        self.assertIn("courier-check=", calls[0][0])
        self.assertEqual(probes, [(b["audio"], self.repo) for b in self.day["blocks"]])

    def test_stale_manifest_rebuild_is_bounded_and_cannot_report_success(self):
        calls, waits = [], []
        def request(url, **kwargs):
            calls.append(kwargs)
            return {"days": []}
        with self.assertRaisesRegex(RuntimeError, "could not be verified"):
            publication.publish(self.manifest, self.day["date"], self.repo, "synthetic-token",
                                request=request, probe=lambda *a: self.fail("Stale edition was probed"),
                                pause=waits.append, attempts=3)
        self.assertEqual(sum(c.get("method") == "POST" for c in calls), 1)
        self.assertEqual(sum(not c for c in calls), 3)
        self.assertEqual(waits, [10, 10])

    def test_unavailable_manifest_recovers_with_one_build(self):
        calls = []
        responses = iter([OSError("Pages unavailable"), {"status": "queued"}, self.manifest])
        def request(url, **kwargs):
            calls.append(kwargs)
            response = next(responses)
            if isinstance(response, OSError):
                raise response
            return response
        item = publication.publish(self.manifest, self.day["date"], self.repo, "synthetic-token",
                                   request=request, probe=lambda *a: None, pause=lambda _: None, attempts=2)
        self.assertEqual(item, self.day)
        self.assertEqual(sum(c.get("method") == "POST" for c in calls), 1)

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

    def test_pin_repaired_sports_preserves_existing_immutable_audio(self):
        prior = self.day["blocks"][0]
        prior["audio"] = prior["audio"].replace("@courier-audio/", "@" + "b" * 40 + "/")
        sports = {**copy.deepcopy(prior), "id": "sports", "audio": "https://cdn.jsdelivr.net/gh/example/courier@courier-audio/2026-09-08/sports.mp3"}
        self.day["blocks"].append(sports)
        original = prior["audio"]
        replaced = publication.pin_audio(self.manifest, self.day["date"], self.repo, "c" * 40)
        self.assertEqual(len(replaced), 1)
        self.assertEqual(prior["audio"], original)
        self.assertIn("@" + "c" * 40 + "/", sports["audio"])


if __name__ == "__main__":
    unittest.main()
