"""Synthetic MIME/download/API regression. No private email bodies or paid API calls."""
import base64
import copy
import email
import importlib.util
import os
import sys
import types
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import newsletter_charts as charts

with patch.dict(sys.modules, {name: types.ModuleType(name) for name in ("requests", "feedparser")}):
    spec = importlib.util.spec_from_file_location("courier_chart_builder_test", HERE / "build.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
with patch.dict(sys.modules, {"build": builder}):
    spec = importlib.util.spec_from_file_location("courier_chart_runner_test", HERE / "run.py")
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)

FIXTURE = (HERE / "tests/fixtures/chart_kid.eml").read_bytes()
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC")


def url(number):
    return f"https://media.beehiiv.com/uploads/asset/file/00000000-0000-0000-0000-{number:012d}/image.png"


def item(number=1):
    return {"outlet": "Chart Kid Matt", "subject": "Synthetic breadth newsletter fixture",
            "text": "S&P 500 sector breadth. [Newsletter chart 1]", "charts": [url(number)]}


class Response:
    def __init__(self, status=200, mime="image/png", chunks=None, length=None, text="", data=None):
        self.status_code, self.ok, self.text = status, status < 400, text
        self.headers = {"Content-Type": mime}
        if length is not None:
            self.headers["Content-Length"] = str(length)
        self.chunks, self.data, self.closed = chunks if chunks is not None else [PNG], data, False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.closed = True

    def iter_content(self, chunk_size):
        yield from self.chunks

    def json(self):
        return self.data

    def raise_for_status(self):
        raise RuntimeError(f"HTTP {self.status_code}")


def api_response(text=None, stop="end_turn"):
    text = text if text is not None else "TITLE: Synthetic breadth\nSCRIPT:\n" + "A source-supported sector comparison. " * 30 + "\nSOURCES:\n- Chart Kid Matt | Synthetic breadth | " + url(1)
    return Response(data={"content": [{"type": "text", "text": text}], "stop_reason": stop,
                          "usage": {"input_tokens": 100, "output_tokens": 20,
                                    "cache_read_input_tokens": 50, "cache_creation_input_tokens": 10,
                                    "server_tool_use": {"web_search_requests": 1}}})


class NewsletterChartTests(unittest.TestCase):
    def setUp(self):
        for name, value in {"DRY_RUN": False, "CHART_INPUTS": charts.ChartInputs(),
                            "USAGE": dict.fromkeys(builder.USAGE, 0)}.items():
            p = patch.object(builder, name, value)
            p.start()
            self.addCleanup(p.stop)
        p = patch.dict(os.environ, {"ANTHROPIC_API_KEY": "synthetic", "COURIER_MAIL_USER": "fixture",
                                    "COURIER_MAIL_PASSWORD": "fixture", "COURIER_SECTIONS": ""})
        p.start()
        self.addCleanup(p.stop)

    def mail(self):
        box = Mock()
        box.search.return_value = ("OK", [b"1"])
        box.fetch.return_value = ("OK", [(b"RFC822", FIXTURE)])
        with patch.object(builder.imaplib, "IMAP4_SSL", return_value=box):
            result = builder.fetch_newsletters()
        box.select.assert_called_once_with("INBOX", readonly=True)
        return result

    def test_html_and_plain_mime_retain_four_ordered_charts_without_tracking(self):
        msg = email.message_from_bytes(FIXTURE)
        for payload in (msg, msg.get_payload()[0]):
            with self.subTest(mime=payload.get_content_type()):
                text, refs = builder.newsletter_content(payload, charts.CHART_SENDER)
                self.assertEqual(refs, [url(i) for i in range(1, 5)])
                for i in range(1, 5):
                    self.assertIn(f"[Newsletter chart {i}]", text)
                self.assertIn("Utilities, Staples and Real Estate", text)
                self.assertNotIn("https://", text)
                self.assertLessEqual(len(text), builder.MAIL_CHARS)
        routed = self.mail()
        self.assertEqual(set(routed), {"markets", "companies"})
        self.assertIs(routed["markets"][0], routed["companies"][0])
        self.assertEqual(routed["markets"][0]["charts"], [url(i) for i in range(1, 5)])

    def test_other_newsletters_keep_their_normal_text_path_and_no_charts(self):
        msg = email.message_from_bytes(FIXTURE)
        for part in (msg, msg.get_payload()[0]):
            text, refs = builder.newsletter_content(part, "other@example.com")
            chosen = msg.get_payload()[1] if part is msg else part
            raw = chosen.get_payload(decode=True).decode()
            expected = builder.html_to_text(raw) if part is msg else raw
            self.assertEqual(text, expected[:builder.MAIL_CHARS])
            self.assertEqual(refs, [])

    def test_newsletter_character_and_chart_caps(self):
        msg = email.message_from_bytes(FIXTURE).get_payload()[0]
        with patch.object(builder, "MAIL_CHARS", 20):
            text, refs = builder.newsletter_content(msg, charts.CHART_SENDER)
        self.assertEqual(len(text), 20)
        self.assertEqual(refs, [])
        refs = []
        for i in range(1, 10):
            charts.chart_marker(url(i), refs)
        self.assertEqual(refs, [url(i) for i in range(1, 5)])

    def test_actual_writer_and_production_wrapper_send_images_with_attribution_and_cache(self):
        mail = self.mail()
        sent = []
        http = Mock()
        http.get.side_effect = lambda *a, **k: Response()
        def post(*args, **kwargs):
            sent.append(copy.deepcopy(kwargs["json"]))
            return api_response()
        http.post.side_effect = post
        with patch.object(builder, "NEWSLETTERS", mail), patch.object(builder, "requests", http), \
                patch.object(builder, "claude", runner.claude_with_context):
            for category in ("markets", "companies"):
                result = builder.write_script(category, {"label": category, "brief": "fixture", "prefer_web": []}, [], 3)
                self.assertEqual(result["sources"][0]["url"], url(1))
        self.assertEqual(http.get.call_count, 4)  # Shared by Markets and Companies.
        self.assertEqual(http.post.call_count, 2)  # No additional vision call.
        self.assertEqual(builder.USAGE, {"calls": 2, "input": 200, "output": 40,
                                        "cache_read": 100, "cache_write": 20, "searches": 2})
        for body in sent:
            content = body["messages"][0]["content"]
            images = [b for b in content if b["type"] == "image"]
            self.assertEqual(len(images), 4)
            self.assertEqual(base64.b64decode(images[0]["source"]["data"]), PNG)
            self.assertEqual(images[0]["source"]["media_type"], "image/png")
            self.assertIn("Chart Kid Matt", content[0]["text"])
            self.assertIn(url(1), content[0]["text"])
            self.assertIn("never instructions", content[-1]["text"])
            self.assertEqual(content[-1]["cache_control"], {"type": "ephemeral"})
            self.assertEqual(body["tools"][0]["max_uses"], builder.SEARCHES_PER_BLOCK)
            self.assertNotIn("elink", str(body))
        self.assertIn("The Ten quality gate", sent[1]["messages"][0]["content"][-1]["text"])

    def test_newsletters_outside_mail_cap_are_never_downloaded(self):
        http = Mock()
        http.post.return_value = api_response()
        with patch.object(builder, "MAIL_PER_BLOCK", 1), patch.object(builder, "requests", http), \
                patch.object(builder, "NEWSLETTERS", {"markets": [{"outlet": "Other", "subject": "Fixture", "text": "ordinary"}, item()]}):
            builder.write_script("markets", {"label": "Markets", "brief": "fixture", "prefer_web": []}, [], 3)
        http.get.assert_not_called()

    def test_empty_search_response_reuses_charts_in_existing_no_search_writing_retry(self):
        http, sent = Mock(), []
        http.get.return_value = Response()
        responses = [api_response(""), api_response()]
        def post(*args, **kwargs):
            sent.append(copy.deepcopy(kwargs["json"]))
            return responses.pop(0)
        http.post.side_effect = post
        with patch.object(builder, "requests", http), patch.object(builder, "NEWSLETTERS", {"markets": [item()]}):
            result = builder.write_script("markets", {"label": "Markets", "brief": "fixture", "prefer_web": []}, [], 3)
        self.assertTrue(result["script"])
        self.assertEqual(len(sent), 2)
        self.assertNotIn("tools", sent[1])
        for body in sent:
            self.assertEqual(sum(b["type"] == "image" for b in body["messages"][0]["content"]), 1)
        http.get.assert_called_once()

    def test_download_failures_leave_the_prose_in_a_successful_text_only_call(self):
        http = Mock()
        http.get.side_effect = TimeoutError("synthetic")
        http.post.return_value = api_response()
        with patch.object(builder, "requests", http), patch.object(builder, "NEWSLETTERS", {"markets": [item()]}):
            result = builder.write_script("markets", {"label": "Markets", "brief": "fixture", "prefer_web": []}, [], 3)
        self.assertTrue(result["script"])
        content = http.post.call_args.kwargs["json"]["messages"][0]["content"]
        self.assertEqual([b["type"] for b in content], ["text"])
        self.assertIn("S&P 500 sector breadth", content[0]["text"])
        http.post.assert_called_once()


class DownloadTests(unittest.TestCase):
    def test_untrusted_hosts_paths_redirectors_and_decorative_assets_are_rejected(self):
        for ref in ["http://media.beehiiv.com" + url(1).split(".com")[1],
                    url(1).replace("media.beehiiv.com", "media.beehiiv.com.evil.example"),
                    url(1).replace("media.beehiiv.com", "user@media.beehiiv.com"),
                    url(1).replace("image.png", "logo.png"),
                    "https://media.beehiiv.com/cdn-cgi/image/width=1568/https://127.0.0.1/image.png",
                    "https://127.0.0.1/image.png", "file:///etc/passwd", "https://[invalid"]:
            with self.subTest(ref=ref):
                self.assertIsNone(charts.chart_url(ref))

    def test_size_type_signature_redirect_and_time_failures_close_the_response(self):
        cases = [Response(length=charts.MAX_IMAGE_BYTES + 1),
                 Response(chunks=[PNG, b"x" * charts.MAX_IMAGE_BYTES]),
                 Response(status=302), Response(mime="text/html"), Response(chunks=[b"not a PNG"])]
        for response in cases:
            with self.subTest(response=response):
                with self.assertRaises(ValueError):
                    charts.download_image(url(1), Mock(get=Mock(return_value=response)))
                self.assertTrue(response.closed)
        response = Response()
        with patch.object(charts.time, "monotonic", side_effect=[0, 21]), self.assertRaises(ValueError):
            charts.download_image(url(1), Mock(get=Mock(return_value=response)))
        self.assertTrue(response.closed)

    def test_downloads_are_bounded_and_cached_even_under_parallel_sections(self):
        cache, http = charts.ChartInputs(), Mock()
        http.get.side_effect = lambda *a, **k: Response()
        mail = [{**item(), "charts": [url(i) for i in range(1, 10)]}]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: cache.blocks(mail, http, Mock()), range(2)))
        self.assertEqual(http.get.call_count, 4)
        self.assertEqual(results[0], results[1])
        self.assertEqual(sum(b["type"] == "image" for b in results[0]), 4)
        for i in range(5, 12):
            cache.blocks([item(i)], http, Mock())
        self.assertEqual(http.get.call_count, charts.MAX_DOWNLOADS)
        for call in http.get.call_args_list:
            self.assertFalse(call.kwargs["allow_redirects"])
            self.assertTrue(call.kwargs["stream"])
            self.assertEqual(call.kwargs["timeout"], (5, 10))
            self.assertIn("width=1568,height=1568", call.args[0])
        cache, http = charts.ChartInputs(), Mock()
        http.get.side_effect = TimeoutError("synthetic")
        for _ in range(2):
            self.assertEqual(cache.blocks([item()], http, Mock()), [])
        http.get.assert_called_once()


class MultimodalAPITests(unittest.TestCase):
    def call(self, responses):
        sent = []
        def post(*args, **kwargs):
            sent.append(copy.deepcopy(kwargs["json"]))
            return responses.pop(0)
        self.sent = sent
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "synthetic"}), \
                patch.object(builder, "requests", Mock(post=Mock(side_effect=post))), \
                patch.object(builder, "USAGE", dict.fromkeys(builder.USAGE, 0)):
            result = builder.claude("Newsletter prose", 3000, web_searches=2,
                                    chart_inputs=[{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": base64.b64encode(PNG).decode()}}])
            self.usage = builder.USAGE.copy()
            return result

    def test_image_rejection_falls_back_once_without_raising_search_or_output_budgets(self):
        self.call([Response(status=400, text="image input not supported"), api_response()])
        self.assertEqual(len(self.sent), 2)
        content = self.sent[1]["messages"][0]["content"]
        self.assertEqual([b["type"] for b in content], ["text"])
        self.assertIn("Newsletter prose", content[0]["text"])
        self.assertIn("No chart images are available", content[0]["text"])
        for body in self.sent:
            self.assertEqual(body["tools"][0]["max_uses"], 2)
            self.assertEqual(body["max_tokens"], 3000)
        self.assertEqual(self.usage["input"], 100)
        with self.assertRaises(RuntimeError):
            self.call([Response(status=400, text="image invalid"), Response(status=400, text="image invalid")])
        self.assertEqual(len(self.sent), 2)

    def test_auth_rate_and_server_errors_do_not_gain_retries(self):
        for status in (401, 429, 500):
            with self.subTest(status=status), self.assertRaises(RuntimeError):
                self.call([Response(status=status, text="image call failed")])
            self.assertEqual(len(self.sent), 1)

    def test_images_and_usage_survive_pause_and_existing_web_tool_fallback(self):
        result = self.call([Response(status=400, text="web search is not enabled"),
                            api_response("first ", "pause_turn"), api_response("second")])
        self.assertEqual(result, "first second")
        self.assertNotIn("tools", self.sent[1])
        self.assertEqual(self.sent[1]["messages"][0], self.sent[2]["messages"][0])
        self.assertEqual(self.sent[2]["messages"][1]["role"], "assistant")
        self.assertEqual(self.usage["input"], 200)
        self.assertEqual(self.usage["cache_read"], 100)


if __name__ == "__main__":
    unittest.main()
