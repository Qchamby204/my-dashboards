"""Financial arithmetic, provenance, budget and failure-path tests; no live or paid calls."""
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import market_snapshot as market
from allocation import adaptive_minutes
from completeness import expected_sections

with patch.dict(sys.modules, {name: types.ModuleType(name) for name in ("requests", "feedparser")}):
    spec = importlib.util.spec_from_file_location("market_builder_test", HERE / "build.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
with patch.dict(sys.modules, {"build": builder}):
    spec = importlib.util.spec_from_file_location("market_runner_test", HERE / "run.py")
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)


def fixture_snapshot():
    return {"schemaVersion": 1, "editionDate": "2026-10-21", "script": "Market snapshot. D F A X rose 1.25 percent.",
            "sources": [{"outlet": "Fixture", "title": "DFAX daily data", "url": "https://example.com/dfax"}],
            "observations": [{"symbol": "DFAX", "asOf": "2026-10-20", "close": 40.5}], "unavailable": []}


class PerformanceTests(unittest.TestCase):
    def test_previous_year_close_is_ytd_baseline_and_current_session_is_excluded(self):
        rows = [("2025-12-31", 100), ("2026-01-02", 110), ("2026-01-05", 121),
                ("2026-01-06", 9999)]
        data = market.performance(rows, "2026-01-06")
        self.assertEqual(data["asOf"], "2026-01-05")
        self.assertAlmostEqual(data["day"], 10)
        self.assertAlmostEqual(data["ytd"], 21)
        self.assertEqual(data["ytdFrom"], "2025-12-31")
        self.assertNotIn("fiveSessions", data)

    def test_five_session_return_uses_six_closes_and_monday_uses_friday(self):
        rows = list(zip(["2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"],
                        [100, 101, 102, 103, 104, 110]))
        data = market.performance(rows, "2026-10-19")
        self.assertAlmostEqual(data["fiveSessions"], 10)
        self.assertEqual(data["fiveSessionsFrom"], "2026-10-09")
        self.assertEqual(data["asOf"], "2026-10-16")

    def test_missing_null_nonfinite_zero_and_stale_data_never_become_returns(self):
        for value in (None, float("nan"), float("inf"), 0, -1, True):
            with self.subTest(value=value):
                data = market.performance([("2026-10-19", 100), ("2026-10-20", value)], "2026-10-21")
                self.assertEqual(data["close"], 100)
                self.assertNotIn("day", data)
        with self.assertRaises(ValueError):
            market.performance([("2026-10-09", 100)], "2026-10-21")

    def test_new_year_without_new_year_session_does_not_label_prior_year_as_ytd(self):
        data = market.performance([("2024-12-31", 80), ("2025-12-31", 100)], "2026-01-01")
        self.assertNotIn("ytd", data)

    def test_quote_symbol_mismatch_fails_closed(self):
        response = Mock()
        response.json.return_value = {"chart": {"result": [{"meta": {"symbol": "WRONG"}}]}}
        with self.assertRaisesRegex(ValueError, "symbol mismatch"):
            market._chart(Mock(get=Mock(return_value=response)), "DFAX", "2026-10-21")


class CollectionTests(unittest.TestCase):
    def quote(self, http, symbol, day):
        return {"asOf": "2026-10-20", "close": 101, "day": 1, "dayFrom": "2026-10-19",
                "currency": "CAD" if symbol == "^GSPTSE" else "USD"}

    def rates(self, http, day, *, canadian):
        names = market.CANADA if canadian else market.FED
        return {"provider": "Bank of Canada" if canadian else "FRED",
                "series": {key: [("2026-10-19", 4), ("2026-10-20", 4.1)] for key in names}}

    def test_rate_changes_use_basis_points_and_primary_ten_year_is_not_duplicated(self):
        with patch.object(market, "_chart", side_effect=self.quote), patch.object(market, "_rates", side_effect=self.rates):
            data = market.collect("2026-10-21", Mock())
        rates = [row for row in data["observations"] if row["kind"] == "rate"]
        self.assertEqual(len(rates), 5)
        self.assertNotIn("^TNX", [row["symbol"] for row in rates])
        self.assertTrue(all(abs(row["changeBps"] - 10) < 1e-8 for row in rates))
        self.assertIn("10.0 basis points", data["script"])
        self.assertEqual(len(data["sources"]), len(data["observations"]))
        self.assertIn("ETF", data["script"])

    def test_primary_rate_outage_keeps_independent_ten_year_yield(self):
        with patch.object(market, "_chart", side_effect=self.quote), patch.object(market, "_rates", side_effect=ValueError("Outage")):
            data = market.collect("2026-10-21", Mock())
        self.assertIn("^TNX", [row["symbol"] for row in data["observations"]])
        self.assertNotIn(market.FED["DGS10"], data["unavailable"])
        self.assertIn(market.FED["DGS2"], data["unavailable"])

    def test_currency_mismatch_is_omitted(self):
        def wrong_currency(*args):
            return {**self.quote(*args), "currency": "EUR"}
        with patch.object(market, "_chart", side_effect=wrong_currency), patch.object(market, "_rates", side_effect=ValueError()):
            data = market.collect("2026-10-21", Mock())
        self.assertFalse(any(row["kind"] == "price" for row in data["observations"]))
        self.assertIn(market.PRICES[-1][1], data["unavailable"])

    def test_complete_outage_has_no_numbers(self):
        with patch.object(market, "_chart", side_effect=ValueError()), patch.object(market, "_rates", side_effect=ValueError()):
            data = market.collect("2026-10-21", Mock())
        self.assertFalse(data["observations"])
        self.assertIn("unavailable", data["script"])
        self.assertFalse(any(char.isdigit() for char in data["script"]))

    def test_fred_html_maintenance_page_is_not_accepted_as_rate_data(self):
        response = Mock(text="<html>Maintenance</html>")
        with self.assertRaisesRegex(ValueError, "requested CSV"):
            market._rates(Mock(get=Mock(return_value=response)), "2026-10-21", canadian=False)

    def test_international_comparison_requires_matching_sessions(self):
        rows = [{"symbol": symbol, "label": symbol, "kind": "price", "unit": "USD", "asOf": "2026-10-20",
                 "dayFrom": baseline, "day": 1, "close": 100}
                for symbol, baseline in (("DFAX", "2026-10-19"), ("VXUS", "2026-10-16"))]
        text = market.narrate({"editionDate": "2026-10-21", "observations": rows, "unavailable": []})
        self.assertNotIn("percentage points for that session", text)


class ProductionOpeningTests(unittest.TestCase):
    def test_numeric_opening_is_prepended_verbatim_and_budget_is_shared_with_commentary(self):
        snap = fixture_snapshot()
        news = {"title": "Rates", "script": "Attributed market explanation.", "sources": []}
        with patch.object(runner, "prepare_market_snapshot", return_value=snap), patch.object(runner, "_BASE_WRITE_SCRIPT", return_value=news) as writing, patch.object(builder, "DRY_RUN", False):
            result = runner.write_script_with_snapshot("markets", {"brief": "Markets"}, [], 4)
        self.assertEqual(result["script"], snap["script"] + "\n\n" + news["script"])
        self.assertLess(writing.call_args.args[3], 4)
        self.assertIn("simultaneous moves do not prove causation", writing.call_args.args[1]["brief"])
        self.assertEqual(result["marketSnapshot"]["observations"], snap["observations"])
        self.assertEqual(result["sources"], snap["sources"])

    def test_commentary_failure_keeps_numeric_opening_and_reports_it(self):
        with patch.object(runner, "prepare_market_snapshot", return_value=fixture_snapshot()), patch.object(runner, "_BASE_WRITE_SCRIPT", side_effect=RuntimeError("Writer failed")), patch.object(builder, "DRY_RUN", False):
            result = runner.write_script_with_snapshot("markets", {"brief": "Markets"}, [], 4)
        self.assertTrue(result["script"].startswith(fixture_snapshot()["script"]))
        self.assertTrue(result["commentaryUnavailable"])

    def test_quiet_markets_keep_opening_inside_thirty_minute_cap(self):
        sources = {slug: {} for slug in builder.DEFAULT_MINUTES}
        plan = {slug: {"owns": [{"event": "Fixture"}] * 10} for slug in sources if slug != "markets"}
        allocated, skipped, _ = adaptive_minutes(sources, plan, {}, market_opening_minutes=3.1)
        self.assertNotIn("markets", skipped)
        self.assertGreaterEqual(allocated["markets"], 3.6)
        self.assertLessEqual(sum(allocated.values()) + builder.LESSONS_MINUTES, 30)
        self.assertEqual(expected_sections("2026-10-21", sources)[:2], ["markets", "lessons"])


if __name__ == "__main__":
    unittest.main()
