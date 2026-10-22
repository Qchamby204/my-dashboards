"""Dated, deterministic market opening. Quote failures never become invented numbers."""
import csv
import io
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from urllib.parse import quote
from zoneinfo import ZoneInfo

# These are price series, not total-return indexes or fund NAVs.
PRICES = (
    ("^GSPTSE", "S and P TSX Composite", "CAD"),
    ("^GSPC", "S and P 500", "USD"),
    ("^IXIC", "Nasdaq Composite", "USD"),
    ("^DJI", "Dow Jones Industrial Average", "USD"),
    ("^RUT", "Russell 2000 small companies", "USD"),
    ("VXUS", "Vanguard total international stock ETF, V X U S", "USD"),
    ("DFAX", "Dimensional World ex U.S. Core Equity 2 ETF, D F A X", "USD"),
)
INDICATORS = (
    ("CADUSD=X", "Canadian dollar", "USD per CAD"),
    ("CL=F", "West Texas oil futures", "USD per barrel"),
    ("GC=F", "Gold futures", "USD per troy ounce"),
    ("^VIX", "VIX implied volatility", "points"),
)
STYLE_PROXIES = (
    ("IWM", "iShares Russell 2000 ETF", "USD"),
    ("IWB", "iShares Russell 1000 ETF", "USD"),
    ("IWD", "iShares Russell 1000 Value ETF", "USD"),
    ("IWF", "iShares Russell 1000 Growth ETF", "USD"),
)
STYLE_PAIRS = (("IWM", "IWB", "U.S. small companies", "U.S. large and mid-sized companies"),
               ("IWD", "IWF", "U.S. value stocks", "U.S. growth stocks"))
FED = {"DGS2": "U.S. two-year Treasury yield", "DGS10": "U.S. ten-year Treasury yield",
       "BAMLH0A0HYM2": "U.S. high-yield option-adjusted credit spread"}
CANADA = {"BD.CDN.2YR.DQ.YLD": "Canada two-year government yield",
          "BD.CDN.10YR.DQ.YLD": "Canada ten-year government yield"}
MAX_AGE_DAYS = 4  # Includes weekends and ordinary long weekends; older quotes are omitted.


def _number(value):
    if isinstance(value, bool):
        raise ValueError("Invalid numeric observation")
    value = float(value)
    if not math.isfinite(value) or value <= 0:
        raise ValueError("Invalid numeric observation")
    return value


def performance(rows, edition_date):
    """Only prior-date observations; never narrate an unfinished edition-day bar."""
    cutoff = date.fromisoformat(edition_date)
    clean = {}
    for day, value in rows:
        day = date.fromisoformat(day)
        if day >= cutoff:
            continue
        try:
            clean[day] = _number(value)
        except (TypeError, ValueError):
            continue
    ordered = sorted(clean.items())
    if not ordered or (cutoff - ordered[-1][0]).days > MAX_AGE_DAYS:
        raise ValueError("Missing or stale daily observations")
    asof, close = ordered[-1]
    result = {"asOf": asof.isoformat(), "close": close}
    for key, index in (("day", -2), ("fiveSessions", -6)):
        if len(ordered) >= abs(index):
            baseline, value = ordered[index]
            result[key] = (close / value - 1) * 100
            result[key + "From"] = baseline.isoformat()
    # The baseline is the last close BEFORE January 1, not the first close of January.
    baseline = [row for row in ordered if row[0].year < asof.year]
    if baseline and asof.year == cutoff.year:
        result["ytd"] = (close / baseline[-1][1] - 1) * 100
        result["ytdFrom"] = baseline[-1][0].isoformat()
    return result


def _chart(http, symbol, edition_date):
    response = http.get("https://query1.finance.yahoo.com/v8/finance/chart/" + quote(symbol, safe=""),
                        params={"range": "2y", "interval": "1d"},
                        headers={"User-Agent": "Mozilla/5.0"}, timeout=12)
    response.raise_for_status()
    payload = response.json()["chart"]["result"][0]
    if payload["meta"]["symbol"] != symbol:
        raise ValueError("Quote symbol mismatch")
    tz = ZoneInfo(payload["meta"]["exchangeTimezoneName"])
    rows = [(datetime.fromtimestamp(stamp, tz).date().isoformat(), value)
            for stamp, value in zip(payload["timestamp"], payload["indicators"]["quote"][0]["close"])]
    return {**performance(rows, edition_date), "currency": payload["meta"].get("currency")}


def _rates(http, edition_date, *, canadian):
    start = (date.fromisoformat(edition_date) - timedelta(days=14)).isoformat()
    if canadian:
        response = http.get("https://www.bankofcanada.ca/valet/observations/" + ",".join(CANADA) + "/json",
                            params={"recent": 12}, timeout=12)
        response.raise_for_status()
        payload = response.json()
        # Verify the series identities against the provider's own labels.
        for key, term in (("BD.CDN.2YR.DQ.YLD", "2 year"), ("BD.CDN.10YR.DQ.YLD", "10 year")):
            label = payload["seriesDetail"][key]["label"].lower().replace("-", " ")
            if term not in label:
                raise ValueError("Unexpected Bank of Canada series")
        return {"series": {key: [(row["d"], row.get(key, {}).get("v")) for row in payload["observations"]]
                           for key in CANADA}, "provider": "Bank of Canada"}
    response = http.get("https://fred.stlouisfed.org/graph/fredgraph.csv",
                        params={"id": ",".join(FED), "cosd": start, "coed": edition_date}, timeout=12)
    response.raise_for_status()
    rows = list(csv.DictReader(io.StringIO(response.text)))
    if not rows or not all(key in rows[0] for key in FED):
        raise ValueError("FRED did not return the requested CSV series")
    return {"series": {key: [(row.get("observation_date") or row.get("DATE"), row.get(key)) for row in rows]
                        for key in FED}, "provider": "FRED"}


def collect(edition_date, http, log=lambda message: None):
    """Bounded parallel public-data requests; partial data stays explicitly partial."""
    result = {"schemaVersion": 1, "editionDate": edition_date, "observations": [], "unavailable": []}
    jobs = [(symbol, label, currency, "price") for symbol, label, currency in PRICES]
    jobs += [(symbol, label, unit, "indicator") for symbol, label, unit in INDICATORS]
    jobs += [(symbol, label, currency, "style") for symbol, label, currency in STYLE_PROXIES]
    jobs.append(("^TNX", FED["DGS10"], "percent", "rate"))

    def fetch(job):
        symbol, label, unit, kind = job
        try:
            values = _chart(http, symbol, edition_date)
            currency = values.pop("currency", None)
            if kind in ("price", "style") and currency != unit:
                raise ValueError("Quote currency mismatch")
            if kind == "rate":
                if "day" in values:
                    previous = values["close"] / (1 + values["day"] / 100)
                    values["changeBps"] = (values["close"] - previous) * 100
                values = {k: v for k, v in values.items() if k in ("asOf", "close", "changeBps", "dayFrom")}
            return {"symbol": symbol, "label": label, "unit": unit, "kind": kind,
                    "url": "https://finance.yahoo.com/quote/" + quote(symbol, safe="") + "/history/",
                    "provider": "Yahoo Finance", **values}
        except Exception as error:
            log(f"market snapshot: {symbol} unavailable ({type(error).__name__})")
            return None

    # Include both rate requests in the same bounded pool as market prices.
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(fetch, job) for job in jobs]
        rates = [pool.submit(_rates, http, edition_date, canadian=flag) for flag in (False, True)]
        for job, future in zip(jobs, futures):
            observation = future.result()
            if observation:
                result["observations"].append(observation)
            else:
                result["unavailable"].append(job[1])
        for names, future, provider in zip((FED, CANADA), rates, ("FRED", "Bank of Canada")):
            try:
                rate_data = future.result()
                series, provider = rate_data["series"], rate_data["provider"]
            except Exception as error:
                log(f"market snapshot: {provider} unavailable ({type(error).__name__})")
                series = {}
            for key, label in names.items():
                try:
                    values = performance(series.get(key, []), edition_date)
                    # Differences in percentage yields/spreads are basis points, not returns.
                    if "dayFrom" in values:
                        previous = next(value for day, value in series[key] if day == values["dayFrom"])
                        values["changeBps"] = (values["close"] - float(previous)) * 100
                    values = {k: v for k, v in values.items() if k in ("asOf", "close", "changeBps", "dayFrom")}
                    result["observations"].append({"symbol": key, "label": label, "kind": "rate",
                        "unit": "percent", "provider": provider,
                        "url": ("https://fred.stlouisfed.org/series/" + key if provider == "FRED" else
                                "https://www.bankofcanada.ca/rates/interest-rates/canadian-bonds/"), **values})
                except (TypeError, ValueError, KeyError):
                    result["unavailable"].append(label)
    # Prefer FRED's Treasury observation; keep the independently fetched 10-year
    # market yield only when the primary feed is missing or stale.
    ids = {row["symbol"] for row in result["observations"]}
    if "DGS10" in ids:
        result["observations"] = [row for row in result["observations"] if row["symbol"] != "^TNX"]
    if "DGS10" in ids or "^TNX" in ids:
        result["unavailable"] = [label for label in result["unavailable"] if label != FED["DGS10"]]
    result["script"] = narrate(result)
    result["sources"] = [{"outlet": row["provider"], "title": row["label"] + " daily data, " + row["asOf"],
                          "url": row["url"]} for row in result["observations"]]
    return result


def _move(value):
    if abs(value) < 0.005:
        return "unchanged"
    return f"{'up' if value > 0 else 'down'} {abs(value):.2f} percent"


def _date_words(value):
    day = date.fromisoformat(value)
    return f"{day:%B} {day.day}, {day.year}"


def narrate(snapshot):
    rows = snapshot["observations"]
    if not rows:
        return ("Market snapshot. Current verified daily market figures are unavailable. "
                "I'll leave those numbers out and move to the sourced market news.")
    lines = ["Market snapshot. These are the latest available daily observations before " + _date_words(snapshot["editionDate"]) +
             ", not live prices. Returns are price changes excluding distributions, in each listing's currency."]
    dates = [row["asOf"] for row in rows if row["kind"] != "style"]
    common_date = max(set(dates), key=lambda value: (dates.count(value), value)) if dates else rows[0]["asOf"]
    lines.append("Figures are as of " + _date_words(common_date) + ", unless another date is given.")
    for row in rows:
        if row["kind"] == "style":
            continue
        day = _date_words(row["asOf"])
        dated = f", dated {day}" if row["asOf"] != common_date else ""
        if row["kind"] == "price":
            line = f"{row['label']}{dated}"
            if "day" in row:
                line += ", " + _move(row["day"]) + " versus the prior day"
            if row["symbol"] in ("^GSPTSE", "^GSPC", "DFAX"):
                if "fiveSessions" in row:
                    line += ", " + _move(row["fiveSessions"]) + " over five days"
                if "ytd" in row:
                    line += ", and " + _move(row["ytd"]) + " year to date"
            if row["symbol"] == "DFAX":
                line += f", at a market price of {row['close']:.2f} U.S. dollars"
            lines.append(line + ".")
        elif row["kind"] == "rate":
            change = row.get("changeBps")
            suffix = (f", {'up' if change >= 0 else 'down'} {abs(change):.1f} basis points versus its prior observation"
                      if change is not None else "")
            lines.append(f"{row['label']}{dated}, {row['close']:.2f} percent{suffix}.")
        else:
            value = f"{row['close']:.4f}" if row["symbol"] == "CADUSD=X" else f"{row['close']:.2f}"
            move = ", " + _move(row["day"]) + " versus its prior daily observation" if "day" in row else ""
            unit = {"USD per CAD": "U.S. dollars per Canadian dollar", "USD per barrel": "U.S. dollars per barrel",
                    "USD per troy ounce": "U.S. dollars per troy ounce"}.get(row["unit"], row["unit"])
            lines.append(f"{row['label']}{dated}, {value} {unit}{move}.")
    by_id = {row["symbol"]: row for row in rows}
    leadership = []
    for left, right, left_label, right_label in STYLE_PAIRS:
        a, b = by_id.get(left), by_id.get(right)
        if not a or not b or "day" not in a or "day" not in b or not a.get("dayFrom"):
            continue
        if (a["asOf"], a["dayFrom"]) != (b["asOf"], b.get("dayFrom")):
            continue
        gap = a["day"] - b["day"]
        movement = ("essentially matched" if abs(gap) < 0.005 else
                    f"{'led' if gap > 0 else 'lagged'} {right_label} by {abs(gap):.2f} percentage points")
        if abs(gap) < 0.005:
            movement += " " + right_label
        dated = f"On {_date_words(a['asOf'])}, " if a["asOf"] != common_date else ""
        leadership.append(f"{dated}{left_label} {movement}.")
    if leadership:
        lines.append("Style leadership. " + " ".join(leadership) +
                     " These are U.S. ETF price comparisons, not isolated factor returns or an attribution of D F A X.")
    a, b = by_id.get("DFAX"), by_id.get("VXUS")
    if a and b and a.get("dayFrom") and (a["asOf"], a["dayFrom"]) == (b["asOf"], b.get("dayFrom")):
        gap = a["day"] - b["day"]
        lines.append(f"D F A X {'led' if gap >= 0 else 'lagged'} the broad international ETF proxy by "
                     f"{abs(gap):.2f} percentage points for that day, both in U.S. dollars. "
                     "This is not an isolated measure of factor performance.")
    two, ten = by_id.get("DGS2"), by_id.get("DGS10") or by_id.get("^TNX")
    if two and ten and two["asOf"] == ten["asOf"]:
        lines.append(f"The U.S. ten-year minus two-year yield curve was "
                     f"{(ten['close'] - two['close']) * 100:.1f} basis points on {_date_words(ten['asOf'])}.")
    if snapshot["unavailable"]:
        lines.append("Unavailable or stale series, omitted: " + "; ".join(snapshot["unavailable"]) + ".")
    lines.append("Now, the sourced developments that may help explain these moves.")
    return "\n\n".join(lines)


def commentary_brief(snapshot):
    """Give the writer context without allowing it to rewrite the numeric opening."""
    return ("A dated market snapshot is already narrated immediately BEFORE your script:\n" + snapshot["script"] +
            "\nStart directly with interpretation; do not repeat the scoreboard or fill missing figures. "
            "Explain two or three material moves using current attributed evidence: rates and rate expectations, "
            "inflation or jobs releases, earnings, sector leadership, breadth, currency, oil, volatility or credit. "
            "Explain the mechanism in plain language and the Canadian investor relevance. Distinguish observed "
            "facts from possible explanations; simultaneous moves do not prove causation. Never infer value, "
            "size or profitability factor returns from DFAX alone. DFAX is an ETF excluding U.S. stocks, "
            "not an index or a global portfolio. Its USD quote is not a CAD investor return. VXUS is a broad "
            "ex-U.S. ETF proxy, not an identical benchmark. Mention key forthcoming economic releases only "
            "when their dates are verified. Skip unsupported explanations.")
